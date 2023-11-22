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
 * @title Balancer pool connector interface
 */
interface IBalancerV2PoolConnector {
    /**
     * @dev The given input length is invalid or do not match
     */
    error BalancerV2InvalidInputLength();

    /**
     * @dev The given tokens out length is not the expected one
     */
    error BalancerV2InvalidTokensOutLength();

    /**
     * @dev The given pool ID and bpt in do not match on Balancer vault
     */
    error BalancerV2InvalidPoolId(bytes32 poolId, address bpt);

    /**
     * @dev The given token does not belong to the pool
     */
    error BalancerV2InvalidToken(bytes32 poolId, address token);

    /**
     * @dev The post balance of the token in unexpected
     */
    error BalancerV2BadTokenInBalance(uint256 postBalance, uint256 preBalance, uint256 amountIn);

    /**
     * @dev The post balance of the token out is unexpected
     */
    error BalancerV2BadTokenOutBalance(uint256 postBalance, uint256 preBalance);

    /**
     * @dev The resulting amount out is lower than the expected min amount out
     */
    error BalancerV2BadAmountOut(uint256 amountOut, uint256 minAmountOut);

    /**
     * @dev Tells the reference to Balancer v2 vault
     */
    function balancerV2Vault() external view returns (address);

    /**
     * @dev Adds liquidity to a Balancer pool
     * @param poolId Balancer pool ID
     * @param tokenIn Address of the token to join the Balancer pool
     * @param amountIn Amount of tokens to join the Balancer pool
     * @param minAmountOut Minimum amount of pool tokens expected to receive after join
     */
    function join(bytes32 poolId, address tokenIn, uint256 amountIn, uint256 minAmountOut)
        external
        returns (uint256 amountOut);

    /**
     * @dev Removes liquidity from a Balancer pool
     * @param tokenIn Address of the pool to exit
     * @param amountIn Amount of pool tokens to exit
     * @param tokensOut List of addresses of tokens in the pool
     * @param minAmountsOut List of min amounts out to be expected for each pool token
     */
    function exit(address tokenIn, uint256 amountIn, address[] memory tokensOut, uint256[] memory minAmountsOut)
        external
        returns (uint256[] memory amountsOut);
}
