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

import '@mimic-fi/v3-helpers/contracts/math/FixedPoint.sol';

import './BaseTask.sol';
import '../interfaces/base/IGasLimitedTask.sol';

/**
 * @dev Gas config for tasks. It allows setting different gas-related configs, specially useful to control relayed txs.
 */
abstract contract GasLimitedTask is IGasLimitedTask, BaseTask {
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
     * @dev Initializes a gas limited task
     */
    function _initialize(GasLimitConfig memory config) internal onlyInitializing {
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
     * @dev Initializes gas limited tasks and validates gas price limit
     */
    function _beforeTask(address, uint256) internal virtual override {
        __initialGas__ = gasleft();
        require(gasPriceLimit == 0 || tx.gasprice <= gasPriceLimit, 'TASK_GAS_PRICE_LIMIT');
        require(priorityFeeLimit == 0 || tx.gasprice - block.basefee <= priorityFeeLimit, 'TASK_PRIORITY_FEE_LIMIT');
    }

    /**
     * @dev Validates transaction cost limit
     */
    function _afterTask(address token, uint256 amount) internal virtual override {
        require(__initialGas__ > 0, 'TASK_GAS_NOT_INITIALIZED');

        uint256 totalGas = __initialGas__ - gasleft();
        uint256 totalCost = totalGas * tx.gasprice;
        require(txCostLimit == 0 || totalCost <= txCostLimit, 'TASK_TX_COST_LIMIT');
        delete __initialGas__;

        if (txCostLimitPct > 0) {
            require(amount > 0, 'TASK_TX_COST_LIMIT_PCT');
            uint256 price = _getPrice(_wrappedNativeToken(), token);
            uint256 totalCostInToken = totalCost.mulUp(price);
            require(totalCostInToken.divUp(amount) <= txCostLimitPct, 'TASK_TX_COST_LIMIT_PCT');
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
        require(newTxCostLimitPct <= FixedPoint.ONE, 'TASK_TX_COST_LIMIT_PCT_ABOVE_ONE');
        txCostLimitPct = newTxCostLimitPct;
        emit TxCostLimitPctSet(newTxCostLimitPct);
    }
}
