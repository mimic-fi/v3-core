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

import '../swap/OneInchV5Swapper.sol';
import './BaseRelayerFunder.sol';

contract OneInchV5RelayerFunder is BaseRelayerFunder, OneInchV5Swapper {
    /**
     * @dev OneInchV5RelayerFunder task config. Only used in the initializer.
     */
    struct OneInchV5RelayerFunderConfig {
        BaseRelayerFunderConfig baseRelayerFunderConfig;
        OneInchV5SwapConfig oneInchV5SwapConfig;
    }

    /**
     * @dev Initializes the 1inch v5 relayer funder
     * @param config OneInchV5RelayerFunder config
     */
    function initialize(OneInchV5RelayerFunderConfig memory config) external virtual initializer {
        __OneInchV5RelayerFunder_init(config);
    }

    /**
     * @dev Initializes the 1inch v5 relayer funder. It does call upper contracts initializers.
     * @param config OneInchV5RelayerFunder config
     */
    function __OneInchV5RelayerFunder_init(OneInchV5RelayerFunderConfig memory config) internal onlyInitializing {
        __OneInchV5Swapper_init(config.oneInchV5SwapConfig);
        __OneInchV5RelayerFunder_init_unchained(config);
    }

    /**
     * @dev Initializes the 1inch v5 relayer funder. It does not call upper contracts initializers.
     * @param config OneInchV5RelayerFunder config
     */
    function __OneInchV5RelayerFunder_init_unchained(OneInchV5RelayerFunderConfig memory config)
        internal
        onlyInitializing
    {
        __BaseRelayerFunder_init_unchained(config.baseRelayerFunderConfig);
    }

    /**
     * @dev Tells the amount in `token` to be funded
     * @param token Address of the token to be used for funding
     */
    function getTaskAmount(address token)
        public
        view
        override(BaseRelayerFunder, IBaseTask, BaseTask)
        returns (uint256)
    {
        return BaseRelayerFunder.getTaskAmount(token);
    }

    /**
     * @dev Before token threshold task hook
     */
    function _beforeTokenThresholdTask(address token, uint256 amount)
        internal
        override(BaseRelayerFunder, TokenThresholdTask)
    {
        BaseRelayerFunder._beforeTokenThresholdTask(token, amount);
    }
}
