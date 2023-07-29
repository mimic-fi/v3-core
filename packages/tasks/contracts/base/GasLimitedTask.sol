// SPDX-License-Identifier: GPL-3.0-or-later
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

pragma solidity ^0.8.17;

import '@mimic-fi/v3-authorizer/contracts/Authorized.sol';
import '@mimic-fi/v3-helpers/contracts/math/FixedPoint.sol';
import '@mimic-fi/v3-smart-vault/contracts/interfaces/ISmartVault.sol';

import '../interfaces/base/IGasLimitedTask.sol';

/**
 * @dev Gas config for tasks. It allows setting different gas-related configs, specially useful to control relayed txs.
 */
abstract contract GasLimitedTask is IGasLimitedTask, Authorized {
    using FixedPoint for uint256;

    // Variable used to allow a better developer experience to reimburse tx gas cost
    // solhint-disable-next-line var-name-mixedcase
    uint256 private __initialGas__;

    // Gas price limit expressed in the native token
    uint256 public override gasPriceLimit;

    // Priority fee limit expressed in the native token
    uint256 public override priorityFeeLimit;

    // Total transaction cost limit expressed in the native token
    uint256 public override txCostLimit;

    // Transaction cost limit percentage
    uint256 public override txCostLimitPct;

    /**
     * @dev Gas limit config params. Only used in the initializer.
     * @param gasPriceLimit Gas price limit expressed in the native token
     * @param priorityFeeLimit Priority fee limit expressed in the native token
     * @param txCostLimit Transaction cost limit to be set
     * @param txCostLimitPct Transaction cost limit percentage to be set
     */
    struct GasLimitConfig {
        uint256 gasPriceLimit;
        uint256 priorityFeeLimit;
        uint256 txCostLimit;
        uint256 txCostLimitPct;
    }

    /**
     * @dev Initializes the gas limited task. It does call upper contracts initializers.
     * @param config Gas limited task config
     */
    function __GasLimitedTask_init(GasLimitConfig memory config) internal onlyInitializing {
        __GasLimitedTask_init_unchained(config);
    }

    /**
     * @dev Initializes the gas limited task. It does not call upper contracts initializers.
     * @param config Gas limited task config
     */
    function __GasLimitedTask_init_unchained(GasLimitConfig memory config) internal onlyInitializing {
        _setGasPriceLimit(config.gasPriceLimit);
        _setPriorityFeeLimit(config.priorityFeeLimit);
        _setTxCostLimit(config.txCostLimit);
        _setTxCostLimitPct(config.txCostLimitPct);
    }

    /**
     * @dev Sets the gas price limit
     * @param newGasPriceLimit New gas price limit to be set
     */
    function setGasPriceLimit(uint256 newGasPriceLimit) external override authP(authParams(newGasPriceLimit)) {
        _setGasPriceLimit(newGasPriceLimit);
    }

    /**
     * @dev Sets the priority fee limit
     * @param newPriorityFeeLimit New priority fee limit to be set
     */
    function setPriorityFeeLimit(uint256 newPriorityFeeLimit) external override authP(authParams(newPriorityFeeLimit)) {
        _setPriorityFeeLimit(newPriorityFeeLimit);
    }

    /**
     * @dev Sets the transaction cost limit
     * @param newTxCostLimit New transaction cost limit to be set
     */
    function setTxCostLimit(uint256 newTxCostLimit) external override authP(authParams(newTxCostLimit)) {
        _setTxCostLimit(newTxCostLimit);
    }

    /**
     * @dev Sets the transaction cost limit percentage
     * @param newTxCostLimitPct New transaction cost limit percentage to be set
     */
    function setTxCostLimitPct(uint256 newTxCostLimitPct) external override authP(authParams(newTxCostLimitPct)) {
        _setTxCostLimitPct(newTxCostLimitPct);
    }

    /**
     * @dev Fetches a base/quote price
     */
    function _getPrice(address base, address quote) internal view virtual returns (uint256);

    /**
     * @dev Initializes gas limited tasks and validates gas price limit
     */
    function _beforeGasLimitedTask(address, uint256) internal virtual {
        __initialGas__ = gasleft();
        bool isGasPriceAllowed = gasPriceLimit == 0 || tx.gasprice <= gasPriceLimit;
        if (!isGasPriceAllowed) revert TaskGasPriceLimitExceeded(tx.gasprice, gasPriceLimit);

        uint256 priorityFee = tx.gasprice - block.basefee;
        bool isPriorityFeeAllowed = priorityFeeLimit == 0 || priorityFee <= priorityFeeLimit;
        if (!isPriorityFeeAllowed) revert TaskPriorityFeeLimitExceeded(priorityFee, priorityFeeLimit);
    }

    /**
     * @dev Validates transaction cost limit
     */
    function _afterGasLimitedTask(address token, uint256 amount) internal virtual {
        if (__initialGas__ == 0) revert TaskGasNotInitialized();

        uint256 totalGas = __initialGas__ - gasleft();
        uint256 totalCost = totalGas * tx.gasprice;
        if (txCostLimit > 0 && totalCost > txCostLimit) revert TaskTxCostLimitExceeded(totalCost, txCostLimit);
        delete __initialGas__;

        if (txCostLimitPct > 0 && amount > 0) {
            uint256 price = _getPrice(ISmartVault(this.smartVault()).wrappedNativeToken(), token);
            uint256 totalCostInToken = totalCost.mulUp(price);
            uint256 txCostPct = totalCostInToken.divUp(amount);
            if (txCostPct > txCostLimitPct) revert TaskTxCostLimitPctExceeded(txCostPct, txCostLimitPct);
        }
    }

    /**
     * @dev Sets the gas price limit
     * @param newGasPriceLimit New gas price limit to be set
     */
    function _setGasPriceLimit(uint256 newGasPriceLimit) internal {
        gasPriceLimit = newGasPriceLimit;
        emit GasPriceLimitSet(newGasPriceLimit);
    }

    /**
     * @dev Sets the priority fee limit
     * @param newPriorityFeeLimit New priority fee limit to be set
     */
    function _setPriorityFeeLimit(uint256 newPriorityFeeLimit) internal {
        priorityFeeLimit = newPriorityFeeLimit;
        emit PriorityFeeLimitSet(newPriorityFeeLimit);
    }

    /**
     * @dev Sets the transaction cost limit
     * @param newTxCostLimit New transaction cost limit to be set
     */
    function _setTxCostLimit(uint256 newTxCostLimit) internal {
        txCostLimit = newTxCostLimit;
        emit TxCostLimitSet(newTxCostLimit);
    }

    /**
     * @dev Sets the transaction cost limit percentage
     * @param newTxCostLimitPct New transaction cost limit percentage to be set
     */
    function _setTxCostLimitPct(uint256 newTxCostLimitPct) internal {
        if (newTxCostLimitPct > FixedPoint.ONE) revert TaskTxCostLimitPctAboveOne();
        txCostLimitPct = newTxCostLimitPct;
        emit TxCostLimitPctSet(newTxCostLimitPct);
    }
}
