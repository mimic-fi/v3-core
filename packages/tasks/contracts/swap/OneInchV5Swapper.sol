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
import '@mimic-fi/v3-connectors/contracts/swap/1inch-v5/OneInchV5Connector.sol';

import './BaseSwapTask.sol';
import '../interfaces/swap/IOneInchV5Swapper.sol';

contract OneInchV5Swapper is IOnceInchV5Swapper, BaseSwapTask {
    using FixedPoint for uint256;

    /**
     * @dev 1inch v5 swapper task config. Only used in the initializer.
     * @param baseSwapConfig Base swap task config params
     */
    struct OneInchV5SwapperConfig {
        BaseSwapConfig baseSwapConfig;
    }

    /**
     * @dev Creates a 1inch v5 swapper task
     */
    function initialize(OneInchV5SwapperConfig memory config) external initializer {
        _initialize(config.baseSwapConfig);
    }

    /**
     * @dev Executes the 1inch V5 swapper task
     */
    function call(address tokenIn, uint256 amountIn, uint256 slippage, bytes memory data)
        external
        authP(authParams(tokenIn, amountIn, slippage))
        baseSwapTaskCall(tokenIn, amountIn, slippage)
    {
        address tokenOut = _getApplicableTokenOut(tokenIn);
        uint256 price = _getPrice(tokenIn, tokenOut);
        uint256 minAmountOut = amountIn.mulUp(price).mulUp(FixedPoint.ONE - slippage);

        bytes memory connectorData = abi.encodeWithSelector(
            OneInchV5Connector.execute.selector,
            tokenIn,
            tokenOut,
            amountIn,
            minAmountOut,
            data
        );

        ISmartVault(smartVault).execute(connector, connectorData);
    }
}
