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

import './BaseRelayerFundTask.sol';
import '../swap/ParaswapV5Swapper.sol';

/**
 * @title Paraswap v5 relayer funder
 * @dev Task used to convert funds in order to pay relayers using Paraswap v5 swapper
 */
contract ParaswapV5RelayerFunder is BaseRelayerFundTask, ParaswapV5Swapper {
    /**
     * @dev Disables the default Paraswap v5 swapper initializer
     */
    function initialize(ParaswapV5SwapConfig memory) external pure override {
        revert TaskInitializerDisabled();
    }

    /**
     * @dev Initializes the Paraswap v5 relayer funder
     * @param config Paraswap v5 swap config
     * @param relayer Relayer address
     */
    function initializeParaswapV5RelayerFunder(ParaswapV5SwapConfig memory config, address relayer)
        external
        virtual
        initializer
    {
        __ParaswapV5RelayerFunder_init(config, relayer);
    }

    /**
     * @dev Initializes the Paraswap v5 relayer funder. It does call upper contracts initializers.
     * @param config Paraswap v5 swap config
     * @param relayer Relayer address
     */
    function __ParaswapV5RelayerFunder_init(ParaswapV5SwapConfig memory config, address relayer)
        internal
        onlyInitializing
    {
        __ParaswapV5Swapper_init(config);
        __BaseRelayerFundTask_init_unchained(BaseRelayerFundConfig(relayer, config.baseSwapConfig.taskConfig));
        __ParaswapV5RelayerFunder_init_unchained(config, relayer);
    }

    /**
     * @dev Initializes the Paraswap v5 relayer funder. It does not call upper contracts initializers.
     * @param config Unwrap config
     * @param relayer Relayer address
     */
    function __ParaswapV5RelayerFunder_init_unchained(ParaswapV5SwapConfig memory config, address relayer)
        internal
        onlyInitializing
    {
        // solhint-disable-previous-line no-empty-blocks
    }

    /**
     * @dev Tells the amount in `token` to be funded
     * @param token Address of the token to be used for funding
     */
    function getTaskAmount(address token)
        public
        view
        override(BaseRelayerFundTask, IBaseTask, BaseTask)
        returns (uint256)
    {
        return BaseRelayerFundTask.getTaskAmount(token);
    }

    /**
     * @dev Before token threshold task hook
     */
    function _beforeTokenThresholdTask(address token, uint256 amount)
        internal
        override(BaseRelayerFundTask, TokenThresholdTask)
    {
        BaseRelayerFundTask._beforeTokenThresholdTask(token, amount);
    }
}
