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
import '../swap/ParaswapV6Swapper.sol';

/**
 * @title Paraswap v6 relayer funder
 * @dev Task used to convert funds in order to pay relayers using Paraswap v6 swapper
 */
contract ParaswapV6RelayerFunder is BaseRelayerFundTask, ParaswapV6Swapper {
    /**
     * @dev Disables the default Paraswap v6 swapper initializer
     */
    function initialize(ParaswapV6SwapConfig memory) external pure override {
        revert TaskInitializerDisabled();
    }

    /**
     * @dev Initializes the Paraswap v6 relayer funder
     * @param config Paraswap v6 swap config
     * @param relayer Relayer address
     */
    function initializeParaswapV6RelayerFunder(ParaswapV6SwapConfig memory config, address relayer)
        external
        virtual
        initializer
    {
        __ParaswapV6RelayerFunder_init(config, relayer);
    }

    /**
     * @dev Initializes the Paraswap v6 relayer funder. It does call upper contracts initializers.
     * @param config Paraswap v6 swap config
     * @param relayer Relayer address
     */
    function __ParaswapV6RelayerFunder_init(ParaswapV6SwapConfig memory config, address relayer)
        internal
        onlyInitializing
    {
        __ParaswapV6Swapper_init(config);
        __BaseRelayerFundTask_init_unchained(BaseRelayerFundConfig(relayer, config.baseSwapConfig.taskConfig));
        __ParaswapV6RelayerFunder_init_unchained(config, relayer);
    }

    /**
     * @dev Initializes the Paraswap v6 relayer funder. It does not call upper contracts initializers.
     * @param config Unwrap config
     * @param relayer Relayer address
     */
    function __ParaswapV6RelayerFunder_init_unchained(ParaswapV6SwapConfig memory config, address relayer)
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
