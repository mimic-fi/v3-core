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

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

import '@mimic-fi/helpers/contracts/utils/ERC20Helpers.sol';

import '../interfaces/balancer/IBalancerV3BatchRouter.sol';
import '../interfaces/balancer/IBalancerV3PoolConnector.sol';
import '../interfaces/permit2/IAllowanceTransfer.sol';

/**
 * @title BalancerV3PoolConnector
 */
contract BalancerV3PoolConnector is IBalancerV3PoolConnector {
    // Reference to Balancer V3 vault
    address public immutable override balancerV3BatchRouter;

    // Reference to Permit2 contract
    address public immutable override permit2;

    /**
     * @dev Creates a new BalancerV3PoolConnector contract
     * @param _balancerV3BatchRouter Balancer V3 batch router reference
     * @param _permit2 Permit2 contract reference
     */
    constructor(address _balancerV3BatchRouter, address _permit2) {
        balancerV3BatchRouter = _balancerV3BatchRouter;
        permit2 = _permit2;
    }

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
    ) external returns (uint256 amountOut) {
        if (steps.length == 0) revert BalancerV3EmptySteps();

        IBalancerV3BatchRouter.SwapPathStep memory lastStep = steps[steps.length - 1];
        address lastStepToken = address(lastStep.tokenOut);
        if (lastStepToken != tokenOut) revert BalancerV3BadTokenOut(tokenOut, lastStepToken);

        uint256 preBalanceIn = IERC20(tokenIn).balanceOf(address(this));
        uint256 preBalanceOut = IERC20(tokenOut).balanceOf(address(this));

        IBalancerV3BatchRouter.SwapPathExactAmountIn memory path = IBalancerV3BatchRouter.SwapPathExactAmountIn({
            tokenIn: IERC20(tokenIn),
            steps: steps,
            exactAmountIn: amountIn,
            minAmountOut: minAmountOut
        });
        IBalancerV3BatchRouter.SwapPathExactAmountIn[]
            memory paths = new IBalancerV3BatchRouter.SwapPathExactAmountIn[](1);
        paths[0] = path;

        uint256 deadline = block.timestamp + 1;

        ERC20Helpers.approve(tokenIn, permit2, amountIn);
        IAllowanceTransfer(permit2).approve(tokenIn, balancerV3BatchRouter, uint160(amountIn), uint48(deadline));

        IBalancerV3BatchRouter(balancerV3BatchRouter).swapExactIn(paths, deadline, false, new bytes(0));

        uint256 postBalanceIn = IERC20(tokenIn).balanceOf(address(this));
        bool isBadTokenInBalance = postBalanceIn < preBalanceIn - amountIn;
        if (isBadTokenInBalance) revert BalancerV3BadTokenInBalance(postBalanceIn, preBalanceIn, amountIn);

        uint256 postBalanceOut = IERC20(tokenOut).balanceOf(address(this));
        bool isBadTokenOutBalance = postBalanceOut < preBalanceOut;
        if (isBadTokenOutBalance) revert BalancerV3BadTokenOutBalance(postBalanceOut, preBalanceOut);

        amountOut = postBalanceOut - preBalanceOut;
        if (amountOut < minAmountOut) revert BalancerV3BadAmountOut(amountOut, minAmountOut);
    }
}
