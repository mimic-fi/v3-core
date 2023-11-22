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

/**
 * @title Balancer v2 swap connector interface
 */
interface IBalancerV2SwapConnector {
    /**
     * @dev The input length mismatch
     */
    error BalancerV2InputLengthMismatch();

    /**
     * @dev The token in is the same as the token out
     */
    error BalancerV2SwapSameToken(address token);

    /**
     * @dev The pool does not exist on the Balancer vault
     */
    error BalancerV2InvalidPool(bytes32 poolId);

    /**
     * @dev The requested tokens do not belong to the pool
     */
    error BalancerV2InvalidPoolTokens(bytes32 poolId, address tokenA, address tokenB);

    /**
     * @dev The returned amount in is not equal to the requested amount in
     */
    error BalancerV2InvalidAmountIn(int256 amountIn);

    /**
     * @dev The returned amount out is greater than or equal to zero
     */
    error BalancerV2InvalidAmountOut(int256 amountOut);

    /**
     * @dev The amount out is lower than the minimum amount out
     */
    error BalancerV2BadAmountOut(uint256 amountOut, uint256 minAmountOut);

    /**
     * @dev The post token in balance is lower than the previous token in balance minus the amount in
     */
    error BalancerV2BadPostTokenInBalance(uint256 postBalanceIn, uint256 preBalanceIn, uint256 amountIn);

    /**
     * @dev Tells the reference to Balancer v2 vault
     */
    function balancerV2Vault() external view returns (address);

    /**
     * @dev Executes a token swap in Balancer V2
     * @param tokenIn Token being sent
     * @param tokenOut Token being received
     * @param amountIn Amount of tokenIn being swapped
     * @param minAmountOut Minimum amount of tokenOut willing to receive
     * @param poolId Pool ID to be used
     * @param hopPoolsIds Optional list of hop-pools between tokenIn and tokenOut, only used for multi-hops
     * @param hopTokens Optional list of hop-tokens between tokenIn and tokenOut, only used for multi-hops
     */
    function execute(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        bytes32 poolId,
        bytes32[] memory hopPoolsIds,
        address[] memory hopTokens
    ) external returns (uint256 amountOut);
}
