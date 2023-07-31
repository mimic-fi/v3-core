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

pragma solidity ^0.8.0;

import '@mimic-fi/v3-helpers/contracts/math/FixedPoint.sol';
import '@mimic-fi/v3-relayer/contracts/interfaces/IRelayer.sol';

import '../Task.sol';
import '../interfaces/relayer/IBaseRelayerFundTask.sol';

/**
 * @title Base relayer fund task
 * @dev Task that offers the basic components for more detailed relayer fund tasks
 */
abstract contract BaseRelayerFundTask is IBaseRelayerFundTask, Task {
    using FixedPoint for uint256;

    // Reference to the contract to be funded
    address public override relayer;

    /**
     * @dev Base relayer fund config. Only used in the initializer.
     */
    struct BaseRelayerFundConfig {
        address relayer;
        TaskConfig taskConfig;
    }

    /**
     * @dev Initializes the base relayer fund task. It does call upper contracts initializers.
     * @param config Base relayer fund config
     */
    function __BaseRelayerFundTask_init(BaseRelayerFundConfig memory config) internal onlyInitializing {
        __Task_init(config.taskConfig);
        __BaseRelayerFundTask_init_unchained(config);
    }

    /**
     * @dev Initializes the base relayer fund task. It does not call upper contracts initializers.
     * @param config Base relayer fund config
     */
    function __BaseRelayerFundTask_init_unchained(BaseRelayerFundConfig memory config) internal onlyInitializing {
        _setRelayer(config.relayer);
    }

    /**
     * @dev Tells the amount in `token` to be paid to the relayer
     * @param token Address of the token to be used to pay the relayer
     */
    function getTaskAmount(address token) public view virtual override(IBaseTask, BaseTask) returns (uint256) {
        Threshold memory threshold = TokenThresholdTask.getTokenThreshold(token);
        if (threshold.token == address(0)) return 0;

        uint256 depositedThresholdToken = _getDepositedInThresholdToken(threshold.token);
        if (depositedThresholdToken >= threshold.min) return 0;

        uint256 usedQuotaThresholdToken = _getUsedQuotaInThresholdToken(threshold.token);
        uint256 diff = threshold.max - depositedThresholdToken + usedQuotaThresholdToken;
        return (token == threshold.token) ? diff : diff.mulUp(_getPrice(threshold.token, token));
    }

    /**
     * @dev Sets the relayer
     * @param newRelayer Address of the relayer to be set
     */
    function setRelayer(address newRelayer) external override authP(authParams(newRelayer)) {
        _setRelayer(newRelayer);
    }

    /**
     * @dev Before token threshold task hook
     */
    function _beforeTokenThresholdTask(address token, uint256 amount) internal virtual override {
        Threshold memory threshold = TokenThresholdTask.getTokenThreshold(token);
        if (threshold.token == address(0)) revert TaskTokenThresholdNotSet(token);

        uint256 amountInThresholdToken = amount.mulUp(_getPrice(token, threshold.token));
        uint256 depositedInThresholdToken = _getDepositedInThresholdToken(threshold.token);
        bool isCurrentBalanceAboveMin = depositedInThresholdToken >= threshold.min;
        if (isCurrentBalanceAboveMin) revert TaskDepositAboveMinThreshold(depositedInThresholdToken, threshold.min);

        uint256 usedQuotaInThresholdToken = _getUsedQuotaInThresholdToken(threshold.token);
        bool coversUsedQuota = usedQuotaInThresholdToken == 0 || amountInThresholdToken > usedQuotaInThresholdToken;
        if (!coversUsedQuota) revert TaskDepositBelowUsedQuota(amountInThresholdToken, usedQuotaInThresholdToken);

        uint256 balanceAfterDeposit = amountInThresholdToken + depositedInThresholdToken - usedQuotaInThresholdToken;
        bool isNewBalanceBelowMin = balanceAfterDeposit < threshold.min;
        if (isNewBalanceBelowMin) revert TaskNewDepositBelowMinThreshold(balanceAfterDeposit, threshold.min);

        bool isNewBalanceAboveMax = balanceAfterDeposit > threshold.max;
        if (isNewBalanceAboveMax) revert TaskNewDepositAboveMaxThreshold(balanceAfterDeposit, threshold.max);
    }

    /**
     * @dev Tells the deposited balance in the relayer expressed in another token
     */
    function _getDepositedInThresholdToken(address token) internal view returns (uint256) {
        // Relayer balance is expressed in ETH
        uint256 depositedNativeToken = IRelayer(relayer).getSmartVaultBalance(smartVault);
        return depositedNativeToken.mulUp(_getPrice(_wrappedNativeToken(), token));
    }

    /**
     * @dev Tells the used quota in the relayer expressed in another token
     */
    function _getUsedQuotaInThresholdToken(address token) internal view returns (uint256) {
        // Relayer used quota is expressed in ETH
        uint256 usedQuotaNativeToken = IRelayer(relayer).getSmartVaultUsedQuota(smartVault);
        return usedQuotaNativeToken.mulUp(_getPrice(_wrappedNativeToken(), token));
    }

    /**
     * @dev Sets the relayer
     * @param newRelayer Address of the relayer to be set
     */
    function _setRelayer(address newRelayer) internal {
        if (newRelayer == address(0)) revert TaskRelayerZero();
        relayer = newRelayer;
        emit RelayerSet(newRelayer);
    }
}
