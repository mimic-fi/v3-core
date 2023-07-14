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
import '@mimic-fi/v3-connectors/contracts/swap/uniswap-v3/UniswapV3Connector.sol';

import './BaseSwapTask.sol';
import './interfaces/IUniSwapV3Swapper.sol';

contract UniswapV3Swapper is IUniswapV3Swapper, BaseSwapTask {
    using FixedPoint for uint256;

    /**
     * @dev Uniswap v3 swapper task config. Only used in the initializer.
     * @param baseSwapConfig Base swap task config params
     */
    struct UniswapV3SwapperConfig {
        BaseSwapConfig baseSwapConfig;
    }

    /**
     * @dev Creates a Uniswap v3 swapper action
     */
    function initialize(UniswapV3SwapperConfig memory _config) external initializer {
        _initialize(_config.baseSwapConfig);
    }

    /**
     * @dev Executes the Uniswap v3 swapper task
     */
    function call(
        address tokenIn,
        uint256 amountIn,
        uint256 slippage,
        uint24 fee,
        address[] memory hopTokens,
        uint24[] memory hopFees
    )
        external
        authP(authParams(tokenIn, amountIn, slippage, fee, hopTokens, hopFees))
        baseSwapTaskCall(tokenIn, amountIn, slippage)
    {
        address tokenOut = _getApplicableTokenOut(tokenIn);
        uint256 price = _getPrice(tokenIn, tokenOut);
        uint256 minAmountOut = amountIn.mulUp(price).mulUp(FixedPoint.ONE - slippage);

        bytes memory connectorData = abi.encodeWithSelector(
            UniswapV3Connector.execute.selector,
            tokenIn,
            tokenOut,
            amountIn,
            minAmountOut,
            fee,
            hopTokens,
            hopFees
        );

        ISmartVault(smartVault).execute(connector, connectorData);
    }
}
