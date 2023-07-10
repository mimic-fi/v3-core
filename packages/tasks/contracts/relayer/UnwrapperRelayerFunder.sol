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

import '../primitives/Unwrapper.sol';
import './BaseRelayerFunder.sol';

contract UnwrapperRelayerFunder is BaseRelayerFunder, Unwrapper {
    /**
     * @dev UnwrapperRelayerFunder task config. Only used in the initializer.
     */
    struct UnwrapperRelayerFunderConfig {
        BaseRelayerFunderConfig baseRelayerFunderConfig;
        UnwrapperConfig unwrapperConfig;
    }

    /**
     * @dev Creates a UnwrapperRelayerFunder task
     * @param config UnwrapperRelayerFunder task config
     */
    function initialize(UnwrapperRelayerFunderConfig memory config) external initializer {
        _initialize(config.baseRelayerFunderConfig);
        initialize(config.unwrapperConfig);
    }

    /**
     * @dev Hook to be called before the task call starts. It calls the base relayer funder hook.
     * It ignores the task hook, since it is already considered in the base relayer funder.
     */
    function _beforeTask(address token, uint256 amount) internal override(BaseRelayerFunder, Unwrapper) {
        BaseRelayerFunder._beforeTask(token, amount);
        // TODO: refactor, copy-paste from Unwrapper
        require(token == _wrappedNativeToken(), 'TASK_NOT_NATIVE_TOKEN');
        require(amount > 0, 'TASK_AMOUNT_ZERO');
    }
}
