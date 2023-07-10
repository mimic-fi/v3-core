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

abstract contract BaseRelayerFunder is Task {
    using FixedPoint for uint256;

    // Reference to the contract to be funded
    IRelayer public relayer;

    /**
     * @dev BaseRelayerFunder task config. Only used in the initializer.
     */
    struct BaseRelayerFunderConfig {
        address relayer;
    }

    /**
     * @dev Creates a BaseRelayerFunder task
     * @param config BaseRelayerFunder task config
     */
    function _initialize(BaseRelayerFunderConfig memory config) internal initializer {
        require(config.relayer != address(0), 'FUNDER_RELAYER_ZERO');
        relayer = IRelayer(config.relayer);
        // task config will be initialized by child contracts
    }

    /**
     * @dev Tells the amount in `token` to be funded
     * @param token Token to be used for funding
     */
    // TODO: make this function override the parent once implemented
    function getTaskAmount(address token) external view returns (uint256) {
        Threshold memory threshold = _getApplicableThreshold(token);
        uint256 depositedThresholdToken = _getDepositedThresholdToken(threshold.token);

        if (depositedThresholdToken >= threshold.min) return 0;

        uint256 diff = threshold.max - depositedThresholdToken;
        return (token == threshold.token) ? diff : diff.mulUp(_getPrice(threshold.token, token));
    }

    /**
     * @dev Hook to be called before the task call starts. Overrides TokenThresholdTask hook.
     */
    function _beforeTask(address token, uint256 amount) internal virtual override {
        // TODO: refactor, copy-paste from Task
        BaseTask._beforeTask(token, amount);
        GasLimitedTask._beforeTask(token, amount);
        TimeLockedTask._beforeTask(token, amount);
        TokenIndexedTask._beforeTask(token, amount);

        Threshold memory threshold = _getApplicableThreshold(token);
        uint256 depositedThresholdToken = _getDepositedThresholdToken(threshold.token);
        require(depositedThresholdToken < threshold.min, 'TASK_THRESHOLD_NOT_MET');
    }

    /**
     * @dev Tells the deposited balance in the relayer in `thresholdToken`
     */
    function _getDepositedThresholdToken(address thresholdToken) internal view returns (uint256) {
        uint256 depositedNativeToken = relayer.getSmartVaultBalance(smartVault); // balance in ETH
        return depositedNativeToken.mulUp(_getPrice(_wrappedNativeToken(), thresholdToken));
    }
}
