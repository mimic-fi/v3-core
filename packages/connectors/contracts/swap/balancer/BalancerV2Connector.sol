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
import '@openzeppelin/contracts/utils/math/SafeCast.sol';

import '@mimic-fi/v3-helpers/contracts/utils/Arrays.sol';
import '@mimic-fi/v3-helpers/contracts/utils/ERC20Helpers.sol';

import './IBalancerV2Vault.sol';
import '../../interfaces/swap/IBalancerV2Connector.sol';

/**
 * @title BalancerV2Connector
 * @dev Interfaces with Balancer V2 to swap tokens
 */
contract BalancerV2Connector is IBalancerV2Connector {
    // Reference to Balancer V2 vault
    address public immutable override balancerV2Vault;

    /**
     * @dev Creates a new BalancerV2Connector contract
     * @param _balancerV2Vault Balancer V2 vault reference
     */
    constructor(address _balancerV2Vault) {
        balancerV2Vault = _balancerV2Vault;
    }

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
    ) external returns (uint256 amountOut) {
        if (tokenIn == tokenOut) revert BalancerV2SwapSameToken(tokenIn);
        if (hopPoolsIds.length != hopTokens.length) revert BalancerV2InputLengthMismatch();

        uint256 preBalanceIn = IERC20(tokenIn).balanceOf(address(this));
        uint256 preBalanceOut = IERC20(tokenOut).balanceOf(address(this));

        ERC20Helpers.approve(tokenIn, balancerV2Vault, amountIn);
        hopPoolsIds.length == 0
            ? _singleSwap(tokenIn, tokenOut, amountIn, minAmountOut, poolId)
            : _batchSwap(tokenIn, tokenOut, amountIn, minAmountOut, poolId, hopPoolsIds, hopTokens);

        uint256 postBalanceIn = IERC20(tokenIn).balanceOf(address(this));
        bool isPostBalanceInUnexpected = postBalanceIn < preBalanceIn - amountIn;
        if (isPostBalanceInUnexpected) revert BalancerV2BadPostTokenInBalance(postBalanceIn, preBalanceIn, amountIn);

        uint256 postBalanceOut = IERC20(tokenOut).balanceOf(address(this));
        amountOut = postBalanceOut - preBalanceOut;
        if (amountOut < minAmountOut) revert BalancerV2BadAmountOut(amountOut, minAmountOut);
    }

    /**
     * @dev Internal function to swap two tokens through BalancerV2 using a single hop
     * @param tokenIn Token being sent
     * @param tokenOut Token being received
     * @param amountIn Amount of tokenIn being swapped
     * @param minAmountOut Minimum amount of tokenOut willing to receive
     * @param poolId Pool ID to be used
     */
    function _singleSwap(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, bytes32 poolId)
        private
        returns (uint256)
    {
        _validatePool(poolId, tokenIn, tokenOut);

        IBalancerV2Vault.SingleSwap memory swap;
        swap.poolId = poolId;
        swap.kind = IBalancerV2Vault.SwapKind.GIVEN_IN;
        swap.assetIn = tokenIn;
        swap.assetOut = tokenOut;
        swap.amount = amountIn;
        swap.userData = new bytes(0);
        return IBalancerV2Vault(balancerV2Vault).swap(swap, _fundManagement(), minAmountOut, block.timestamp);
    }

    /**
     * @dev Internal function to swap two tokens through BalancerV2 using a multi hop
     * @param tokenIn Token being sent
     * @param tokenOut Token being received
     * @param amountIn Amount of tokenIn to be swapped
     * @param minAmountOut Minimum amount of tokenOut willing to receive
     * @param poolId Pool ID to be used
     * @param hopPoolsIds List of hop-pools between tokenIn and tokenOut, only used for multi-hops
     * @param hopTokens List of hop-tokens between tokenIn and tokenOut, only used for multi-hops
     */
    function _batchSwap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        bytes32 poolId,
        bytes32[] memory hopPoolsIds,
        address[] memory hopTokens
    ) private returns (uint256) {
        // Validate pool IDs. No need to validate hop arrays length as it was validated in the execute function.
        bytes32[] memory poolIds = Arrays.from(poolId, hopPoolsIds);
        address[] memory tokens = Arrays.from(tokenIn, hopTokens, tokenOut);
        for (uint256 i = 0; i < poolIds.length; i++) {
            _validatePool(poolIds[i], tokens[i], tokens[i + 1]);
        }

        // Build list of swap steps
        uint256 steps = tokens.length - 1;
        IBalancerV2Vault.BatchSwapStep[] memory swaps = new IBalancerV2Vault.BatchSwapStep[](steps);
        for (uint256 j = 0; j < steps; j++) {
            IBalancerV2Vault.BatchSwapStep memory swap = swaps[j];
            swap.amount = j == 0 ? amountIn : 0;
            swap.poolId = poolIds[j];
            swap.assetInIndex = j;
            swap.assetOutIndex = j + 1;
            swap.userData = new bytes(0);
        }

        // Build limits values
        int256[] memory limits = new int256[](tokens.length);
        limits[0] = SafeCast.toInt256(amountIn);
        limits[limits.length - 1] = SafeCast.toInt256(minAmountOut) * -1;

        // Swap
        int256[] memory results = IBalancerV2Vault(balancerV2Vault).batchSwap(
            IBalancerV2Vault.SwapKind.GIVEN_IN,
            swaps,
            tokens,
            _fundManagement(),
            limits,
            block.timestamp
        );

        // Validate output
        int256 intAmountOut = results[results.length - 1];
        if (intAmountOut >= 0) revert BalancerV2InvalidAmountOut(intAmountOut);
        if (SafeCast.toUint256(results[0]) != amountIn) revert BalancerV2InvalidAmountIn(results[0]);
        return uint256(intAmountOut * -1);
    }

    /**
     * @dev Internal function to validate that there is a pool created for tokenA and tokenB with a requested pool ID
     * @param poolId Balancer pool ID
     * @param tokenA One of the tokens in the pool
     * @param tokenB The other token in the pool
     */
    function _validatePool(bytes32 poolId, address tokenA, address tokenB) private view {
        (address pool, ) = IBalancerV2Vault(balancerV2Vault).getPool(poolId);
        if (pool == address(0)) revert BalancerV2InvalidPool(poolId);

        bool containsA;
        bool containsB;
        (IERC20[] memory tokens, , ) = IBalancerV2Vault(balancerV2Vault).getPoolTokens(poolId);

        for (uint256 i = 0; i < tokens.length; i++) {
            if (address(tokens[i]) == tokenA) containsA = true;
            if (address(tokens[i]) == tokenB) containsB = true;
        }

        if (!containsA || !containsB) revert BalancerV2InvalidPoolTokens(poolId, tokenA, tokenB);
    }

    /**
     * @dev Internal function to build the fund management struct required by Balancer for swaps
     */
    function _fundManagement() private view returns (IBalancerV2Vault.FundManagement memory) {
        return
            IBalancerV2Vault.FundManagement({
                sender: address(this),
                fromInternalBalance: false,
                recipient: payable(address(this)),
                toInternalBalance: false
            });
    }
}
