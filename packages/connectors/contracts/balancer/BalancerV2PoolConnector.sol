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
import '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';

import '@mimic-fi/v3-helpers/contracts/math/FixedPoint.sol';
import '@mimic-fi/v3-helpers/contracts/utils/ERC20Helpers.sol';

import '../interfaces/balancer/IBalancerPool.sol';
import '../interfaces/balancer/IBalancerV2Vault.sol';
import '../interfaces/balancer/IBalancerV2PoolConnector.sol';

/**
 * @title BalancerV2PoolConnector
 */
contract BalancerV2PoolConnector is IBalancerV2PoolConnector {
    using FixedPoint for uint256;

    // ID of the action type used internally by Balancer in order to join a Balancer pool
    uint256 private constant JOIN_POOL_EXACT_TOKENS_IN_FOR_BPT_OUT = 1;

    // ID of the action type used internally by Balancer in order to exit a Balancer pool
    uint256 private constant EXIT_POOL_EXACT_BPT_IN_FOR_TOKENS_OUT = 1;

    // Reference to Balancer V2 vault
    address public immutable override balancerV2Vault;

    /**
     * @dev Creates a new BalancerV2SwapConnector contract
     * @param _balancerV2Vault Balancer V2 vault reference
     */
    constructor(address _balancerV2Vault) {
        balancerV2Vault = _balancerV2Vault;
    }

    /**
     * @dev Adds liquidity to a Balancer pool
     * @param poolId Balancer pool ID
     * @param tokenIn Address of the token to join the Balancer pool
     * @param amountIn Amount of tokens to join the Balancer pool
     * @param minAmountOut Minimum amount of pool tokens expected to receive after join
     */
    function join(bytes32 poolId, address tokenIn, uint256 amountIn, uint256 minAmountOut)
        external
        override
        returns (uint256 amountOut)
    {
        // Validate pool tokens
        (address pool, ) = IBalancerV2Vault(balancerV2Vault).getPool(poolId);
        (IERC20[] memory assets, uint256[] memory amountsIn) = _buildAmountsIn(poolId, tokenIn, amountIn);

        // Track pre balances
        uint256 preBalanceIn = IERC20(tokenIn).balanceOf(address(this));
        uint256 preBalanceOut = IERC20(pool).balanceOf(address(this));

        // Build join request
        IBalancerV2Vault.JoinPoolRequest memory request = IBalancerV2Vault.JoinPoolRequest({
            assets: assets,
            maxAmountsIn: amountsIn,
            userData: abi.encode(JOIN_POOL_EXACT_TOKENS_IN_FOR_BPT_OUT, amountsIn, minAmountOut),
            fromInternalBalance: false
        });

        // Join pool
        ERC20Helpers.approve(tokenIn, balancerV2Vault, amountIn);
        IBalancerV2Vault(balancerV2Vault).joinPool(poolId, address(this), payable(address(this)), request);

        // Validate amount in
        uint256 postBalanceIn = IERC20(tokenIn).balanceOf(address(this));
        bool isBadTokenInBalance = postBalanceIn < preBalanceIn - amountIn;
        if (isBadTokenInBalance) revert BalancerV2BadTokenInBalance(postBalanceIn, preBalanceIn, amountIn);

        // Validate amount out
        uint256 postBalanceOut = IERC20(pool).balanceOf(address(this));
        bool isBadTokenOutBalance = postBalanceOut < preBalanceOut;
        if (isBadTokenOutBalance) revert BalancerV2BadTokenOutBalance(postBalanceOut, preBalanceOut);

        // Validate min amount out
        amountOut = postBalanceOut - preBalanceOut;
        if (amountOut < minAmountOut) revert BalancerV2BadAmountOut(amountOut, minAmountOut);
    }

    /**
     * @dev Removes liquidity from a Balancer pool
     * @param tokenIn Address of the pool to exit
     * @param amountIn Amount of pool tokens to exit
     * @param tokensOut List of addresses of tokens in the pool
     * @param minAmountsOut List of min amounts out to be expected for each pool token
     */
    function exit(address tokenIn, uint256 amountIn, address[] memory tokensOut, uint256[] memory minAmountsOut)
        external
        override
        returns (uint256[] memory amountsOut)
    {
        // Validate pool
        bytes32 poolId = IBalancerPool(tokenIn).getPoolId();
        (address pool, ) = IBalancerV2Vault(balancerV2Vault).getPool(poolId);
        uint256 preBalanceIn = IERC20(pool).balanceOf(address(this));
        if (pool != tokenIn) revert BalancerV2InvalidPoolId(poolId, tokenIn);

        // Validate pool tokens
        if (tokensOut.length != minAmountsOut.length) revert BalancerV2InvalidInputLength();
        (IERC20[] memory assets, uint256[] memory preBalancesOut) = _getBalancesAndValidate(poolId, tokensOut);

        // Build exit request
        IBalancerV2Vault.ExitPoolRequest memory request = IBalancerV2Vault.ExitPoolRequest({
            assets: assets,
            minAmountsOut: minAmountsOut,
            userData: abi.encodePacked(EXIT_POOL_EXACT_BPT_IN_FOR_TOKENS_OUT, amountIn),
            toInternalBalance: false
        });

        // Exit pool
        ERC20Helpers.approve(tokenIn, balancerV2Vault, amountIn);
        IBalancerV2Vault(balancerV2Vault).exitPool(poolId, address(this), payable(address(this)), request);

        // Validate amount in
        uint256 postBalanceIn = IERC20(tokenIn).balanceOf(address(this));
        bool isBadTokenInBalance = postBalanceIn < preBalanceIn - amountIn;
        if (isBadTokenInBalance) revert BalancerV2BadTokenInBalance(postBalanceIn, preBalanceIn, amountIn);

        amountsOut = new uint256[](tokensOut.length);
        for (uint256 i = 0; i < tokensOut.length; i++) {
            // Validate amounts out
            uint256 preBalanceOut = preBalancesOut[i];
            uint256 postBalanceOut = IERC20(tokensOut[i]).balanceOf(address(this));
            bool isBadTokenOutBalance = postBalanceOut < preBalanceOut;
            if (isBadTokenOutBalance) revert BalancerV2BadTokenOutBalance(postBalanceOut, preBalanceOut);

            // Validate min amount out
            uint256 amountOut = postBalanceOut - preBalanceOut;
            if (amountOut < minAmountsOut[i]) revert BalancerV2BadAmountOut(amountOut, minAmountsOut[i]);
            amountsOut[i] = amountOut;
        }
    }

    /**
     * @dev Internal function to fetch a list of token balances for a pool and also validate the list of tokens
     */
    function _buildAmountsIn(bytes32 poolId, address tokenIn, uint256 amountIn)
        private
        view
        returns (IERC20[] memory assets, uint256[] memory amountsIn)
    {
        (assets, , ) = IBalancerV2Vault(balancerV2Vault).getPoolTokens(poolId);
        amountsIn = new uint256[](assets.length);

        bool isTokenInValid = false;
        for (uint256 i = 0; i < assets.length; i++) {
            if (address(assets[i]) == tokenIn) {
                isTokenInValid = true;
                amountsIn[i] = amountIn;
                break;
            }
        }

        if (!isTokenInValid) revert BalancerV2InvalidToken(poolId, tokenIn);
    }

    /**
     * @dev Internal function to fetch a list of token balances for a pool and also validate the list of tokens
     */
    function _getBalancesAndValidate(bytes32 poolId, address[] memory tokensOut)
        private
        view
        returns (IERC20[] memory assets, uint256[] memory balances)
    {
        (assets, , ) = IBalancerV2Vault(balancerV2Vault).getPoolTokens(poolId);
        if (assets.length != tokensOut.length) revert BalancerV2InvalidTokensOutLength();

        balances = new uint256[](tokensOut.length);
        for (uint256 i = 0; i < assets.length; i++) {
            if (address(assets[i]) != tokensOut[i]) revert BalancerV2InvalidToken(poolId, tokensOut[i]);
            balances[i] = assets[i].balanceOf(address(this));
        }
    }
}
