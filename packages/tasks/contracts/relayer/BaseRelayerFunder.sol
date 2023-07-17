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

import '../interfaces/relayer/IBaseRelayerFunder.sol';
import '../Task.sol';

abstract contract BaseRelayerFunder is IBaseRelayerFunder, Task {
    using FixedPoint for uint256;

    // Reference to the contract to be funded
    IRelayer public relayer;

    /**
     * @dev BaseRelayerFunder task config. Only used in the initializer.
     */
    struct BaseRelayerFunderConfig {
        address relayer;
        TaskConfig taskConfig;
    }

    /**
     * @dev Initializes the base relayer funder. It does call upper contracts initializers.
     * @param config BaseRelayerFunder config
     */
    function __BaseRelayerFunder_init(BaseRelayerFunderConfig memory config) internal onlyInitializing {
        __Task_init(config.taskConfig);
        __BaseRelayerFunder_init_unchained(config);
    }

    /**
     * @dev Initializes the base relayer funder. It does not call upper contracts initializers.
     * @param config BaseRelayerFunder config
     */
    function __BaseRelayerFunder_init_unchained(BaseRelayerFunderConfig memory config) internal onlyInitializing {
        require(config.relayer != address(0), 'FUNDER_RELAYER_ZERO');
        relayer = IRelayer(config.relayer);
    }

    /**
     * @dev Tells the amount in `token` to be funded
     * @param token Address of the token to be used for funding
     */
    function getTaskAmount(address token) public view virtual override(IBaseTask, BaseTask) returns (uint256) {
        Threshold memory threshold = TokenThresholdTask.getTokenThreshold(token);
        uint256 depositedThresholdToken = _getDepositedThresholdToken(threshold.token);
        uint256 usedQuotaThresholdToken = relayer.getSmartVaultUsedQuota(smartVault).mulUp(
            _getPrice(_wrappedNativeToken(), threshold.token)
        );

        if (depositedThresholdToken >= threshold.min) return 0;

        uint256 diff = threshold.max - depositedThresholdToken + usedQuotaThresholdToken; // usedQuota > 0 implies deposited = 0
        return (token == threshold.token) ? diff : diff.mulUp(_getPrice(threshold.token, token));
    }

    /**
     * @dev Before token threshold task hook
     */
    function _beforeTokenThresholdTask(address token, uint256 amount) internal virtual override {
        Threshold memory threshold = TokenThresholdTask.getTokenThreshold(token);
        uint256 depositedThresholdToken = _getDepositedThresholdToken(threshold.token);
        uint256 usedQuotaThresholdToken = relayer.getSmartVaultUsedQuota(smartVault).mulUp(
            _getPrice(_wrappedNativeToken(), threshold.token)
        );
        require(depositedThresholdToken < threshold.min + usedQuotaThresholdToken, 'TASK_TOKEN_THRESHOLD_NOT_MET');
        require(amount <= threshold.max + usedQuotaThresholdToken, 'TASK_TOKEN_THRESHOLD_MAX');
    }

    /**
     * @dev Tells the deposited balance in the relayer in `thresholdToken`
     */
    function _getDepositedThresholdToken(address thresholdToken) internal view returns (uint256) {
        uint256 depositedNativeToken = relayer.getSmartVaultBalance(smartVault); // balance in ETH
        return depositedNativeToken.mulUp(_getPrice(_wrappedNativeToken(), thresholdToken));
    }
}
