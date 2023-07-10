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
        OneInchV5SwapperConfig oneInchV5SwapperConfig;
    }

    /**
     * @dev Creates a OneInchV5RelayerFunder task
     * @param config OneInchV5RelayerFunder task config
     */
    function initialize(OneInchV5RelayerFunderConfig memory config) external initializer {
        _initialize(config.baseRelayerFunderConfig);
        initialize(config.oneInchV5SwapperConfig);
    }

    /**
     * @dev Hook to be called before the task call starts. It calls the base relayer funder hook.
     * It ignores the task hook, since it is already considered in the base relayer funder.
     */
    function _beforeTask(address token, uint256 amount) internal override(BaseRelayerFunder, Task) {
        BaseRelayerFunder._beforeTask(token, amount);
    }
}
