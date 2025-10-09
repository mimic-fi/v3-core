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

pragma solidity >=0.8.0;

import './IBalancerV3BatchRouter.sol';

/**
 * @title Balancer v3 pool connector interface
 */
interface IBalancerV3PoolConnector {
    /**
     * @dev The steps array is empty
     */
    error BalancerV3EmptySteps();

    /**
     * @dev The token out does not match the last step token out
     */
    error BalancerV3BadTokenOut(address current, address expected);

    /**
     * @dev The post balance of the token in unexpected
     */
    error BalancerV3BadTokenInBalance(uint256 postBalance, uint256 preBalance, uint256 amountIn);

    /**
     * @dev The post balance of the token out is unexpected
     */
    error BalancerV3BadTokenOutBalance(uint256 postBalance, uint256 preBalance);

    /**
     * @dev The resulting amount out is lower than the expected min amount out
     */
    error BalancerV3BadAmountOut(uint256 amountOut, uint256 minAmountOut);

    /**
     * @dev Tells the reference to Balancer v3 batch router
     */
    function balancerV3BatchRouter() external view returns (address);

    /**
     * @dev Tells the reference to Permit2 contract
     */
    function permit2() external view returns (address);

    /**
     * @dev Executes a token swap using Balancer v3 pools
     * @param tokenIn Token being sent
     * @param tokenOut Token being received
     * @param amountIn Amount of tokenIn being swapped
     * @param minAmountOut Minimum amount of tokenOut willing to receive
     * @param steps List of steps containing the pools to be used
     */
    function execute(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        IBalancerV3BatchRouter.SwapPathStep[] memory steps
    ) external returns (uint256 amountOut);
}
