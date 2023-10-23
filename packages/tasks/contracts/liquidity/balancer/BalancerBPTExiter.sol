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

import '../../Task.sol';
import '../../interfaces/liquidity/balancer/IBalancerBPTExiter.sol';
import '../../interfaces/liquidity/balancer/IBalancerLinearPool.sol';
import '../../interfaces/liquidity/balancer/IBalancerBoostedPool.sol';
import '../../interfaces/liquidity/balancer/IBalancerPool.sol';
import '../../interfaces/liquidity/balancer/IBalancerVault.sol';

// solhint-disable avoid-low-level-calls

/**
 * @title Balancer BPT exiter
 * @dev Task that offers the components to exit Balancer pools
 */
contract BalancerBPTExiter is IBalancerBPTExiter, Task {
    // Private constant used to exit Balancer pools
    uint256 private constant EXACT_BPT_IN_FOR_TOKENS_OUT = 1;

    // Execution type for relayers
    bytes32 public constant override EXECUTION_TYPE = keccak256('BPT_EXITER');

    // Balancer vault reference. It cannot be changed.
    address public override balancerVault;

    /**
     * @dev Balancer BPT exit config. Only used in the initializer.
     */
    struct BPTExitConfig {
        address balancerVault;
        TaskConfig taskConfig;
    }

    /**
     * @dev Initializes a Balancer BPT exiter
     * @param config Balancer BPT exit config
     */
    function initialize(BPTExitConfig memory config) external virtual initializer {
        __BalancerBPTExiter_init(config);
    }

    /**
     * @dev Initializes the Balancer BPT exiter. It does call upper contracts initializers.
     * @param config Balancer BPT exit config
     */
    function __BalancerBPTExiter_init(BPTExitConfig memory config) internal onlyInitializing {
        __Task_init(config.taskConfig);
        __BalancerBPTExiter_init_unchained(config);
    }

    /**
     * @dev Initializes the Balancer BPT exiter. It does not call upper contracts initializers.
     * @param config Balancer BPT exit config
     */
    function __BalancerBPTExiter_init_unchained(BPTExitConfig memory config) internal onlyInitializing {
        balancerVault = config.balancerVault;
    }

    /**
     * @dev Execute Balancer BPT exiter
     * @param token Address of the Balancer pool token to exit
     * @param amount Amount of Balancer pool tokens to exit
     */
    function call(address token, uint256 amount) external override authP(authParams(token, amount)) {
        if (amount == 0) amount = getTaskAmount(token);
        _beforeBalancerBPTExiter(token, amount);

        (bytes memory data, IERC20[] memory tokensOut, uint256[] memory minAmountsOut) = _buildSwapCall(token, amount);
        uint256[] memory preBalances = _getBalances(tokensOut);

        ISmartVault(smartVault).call(token, abi.encodeWithSelector(IERC20.approve.selector, balancerVault, amount), 0);
        ISmartVault(smartVault).call(balancerVault, data, 0);

        uint256[] memory amountsOut = _getAmountsOut(tokensOut, preBalances, minAmountsOut);
        _afterBalancerBPTExiter(token, amount, tokensOut, amountsOut);
    }

    /**
     * @dev Before Balancer BPT exiter hook
     */
    function _beforeBalancerBPTExiter(address token, uint256 amount) internal virtual {
        _beforeTask(token, amount);
        if (token == address(0)) revert TaskTokenZero();
        if (amount == 0) revert TaskAmountZero();
    }

    /**
     * @dev After Balancer BPT exiter hook
     */
    function _afterBalancerBPTExiter(
        address tokenIn,
        uint256 amountIn,
        IERC20[] memory tokensOut,
        uint256[] memory amountsOut
    ) internal virtual {
        for (uint256 i = 0; i < tokensOut.length; i++) _increaseBalanceConnector(address(tokensOut[i]), amountsOut[i]);
        _afterTask(tokenIn, amountIn);
    }

    /**
     * @dev Builds the corresponding data to swap a BPT into its underlying tokens
     * @param pool Address of the Balancer pool token to swap
     * @param amount Amount of Balancer pool tokens to swap
     */
    function _buildSwapCall(address pool, uint256 amount)
        private
        view
        returns (bytes memory data, IERC20[] memory tokensOut, uint256[] memory minAmountsOut)
    {
        try IBalancerLinearPool(pool).getMainToken() returns (address main) {
            uint256 minAmountOut;
            (data, minAmountOut) = _buildLinearPoolSwap(pool, amount, main);
            tokensOut = new IERC20[](1);
            tokensOut[0] = IERC20(main);
            minAmountsOut = new uint256[](1);
            minAmountsOut[0] = minAmountOut;
        } catch {
            try IBalancerBoostedPool(pool).getBptIndex() returns (uint256 bptIndex) {
                address underlying;
                uint256 minAmountOut;
                (data, underlying, minAmountOut) = _buildBoostedPoolSwap(pool, amount, bptIndex);
                tokensOut = new IERC20[](1);
                tokensOut[0] = IERC20(underlying);
                minAmountsOut = new uint256[](1);
                minAmountsOut[0] = minAmountOut;
            } catch {
                return _buildNormalPoolExit(pool, amount);
            }
        }
    }

    /**
     * @dev Exit normal pools using an exact BPT for tokens out. Note that there is no need to compute
     * minimum amounts since this is considered a proportional exit.
     * @param pool Address of the Balancer pool token to exit
     * @param amount Amount of Balancer pool tokens to exit
     */
    function _buildNormalPoolExit(address pool, uint256 amount)
        private
        view
        returns (bytes memory data, IERC20[] memory tokens, uint256[] memory minAmountsOut)
    {
        // Fetch the list of tokens of the pool
        bytes32 poolId = IBalancerPool(pool).getPoolId();
        (tokens, , ) = IBalancerVault(balancerVault).getPoolTokens(poolId);

        // Proportional exit
        minAmountsOut = new uint256[](tokens.length);
        IBalancerVault.ExitPoolRequest memory request = IBalancerVault.ExitPoolRequest({
            assets: tokens,
            minAmountsOut: minAmountsOut,
            userData: abi.encodePacked(EXACT_BPT_IN_FOR_TOKENS_OUT, amount),
            toInternalBalance: false
        });

        data = abi.encodeWithSelector(
            IBalancerVault.exitPool.selector,
            poolId,
            address(smartVault),
            payable(address(smartVault)),
            request
        );
    }

    /**
     * @dev Exit linear pools using a swap request in exchange for the main token of the pool. The min amount out is
     * computed based on the current rate of the linear pool.
     * @param pool Address of the Balancer pool token to swap
     * @param amount Amount of Balancer pool tokens to swap
     * @param main Address of the main token
     */
    function _buildLinearPoolSwap(address pool, uint256 amount, address main)
        private
        view
        returns (bytes memory data, uint256 minAmountOut)
    {
        // Compute minimum amount out in the main token
        uint256 rate = IBalancerLinearPool(pool).getRate();
        uint256 decimals = IERC20Metadata(main).decimals();
        minAmountOut = _getMinAmountOut(rate, decimals);

        // Swap from linear to main token
        IBalancerVault.SingleSwap memory request = IBalancerVault.SingleSwap({
            poolId: IBalancerPool(pool).getPoolId(),
            kind: IBalancerVault.SwapKind.GIVEN_IN,
            assetIn: pool,
            assetOut: main,
            amount: amount,
            userData: new bytes(0)
        });

        // Build fund management object: smart vault is the sender and recipient
        IBalancerVault.FundManagement memory funds = IBalancerVault.FundManagement({
            sender: address(smartVault),
            fromInternalBalance: false,
            recipient: payable(address(smartVault)),
            toInternalBalance: false
        });

        data = abi.encodeWithSelector(IBalancerVault.swap.selector, request, funds, minAmountOut, block.timestamp);
    }

    /**
     * @dev Exit boosted pools using a swap request in exchange for the first underlying token of the pool. The min
     * amount out is computed based on the current rate of the boosted pool.
     * @param pool Address of the Balancer pool token to swap
     * @param amount Amount of Balancer pool tokens to swap
     * @param bptIndex Index of the BPT in the list of tokens tracked by the Balancer Vault
     */
    function _buildBoostedPoolSwap(address pool, uint256 amount, uint256 bptIndex)
        private
        view
        returns (bytes memory data, address underlying, uint256 minAmountOut)
    {
        // Pick the first underlying token of the boosted pool
        bytes32 poolId = IBalancerPool(pool).getPoolId();
        (IERC20[] memory tokens, , ) = IBalancerVault(balancerVault).getPoolTokens(poolId);
        underlying = address(bptIndex == 0 ? tokens[1] : tokens[0]);

        // Compute minimum amount out in the underlying token
        uint256 rate = IBalancerBoostedPool(pool).getRate();
        uint256 decimals = IERC20Metadata(underlying).decimals();
        minAmountOut = _getMinAmountOut(rate, decimals);

        // Swap from BPT to underlying token
        IBalancerVault.SingleSwap memory request = IBalancerVault.SingleSwap({
            poolId: IBalancerPool(pool).getPoolId(),
            kind: IBalancerVault.SwapKind.GIVEN_IN,
            assetIn: pool,
            assetOut: underlying,
            amount: amount,
            userData: new bytes(0)
        });

        // Build fund management object: smart vault is the sender and recipient
        IBalancerVault.FundManagement memory funds = IBalancerVault.FundManagement({
            sender: address(smartVault),
            fromInternalBalance: false,
            recipient: payable(address(smartVault)),
            toInternalBalance: false
        });

        data = abi.encodeWithSelector(IBalancerVault.swap.selector, request, funds, minAmountOut, block.timestamp);
    }

    /**
     * @dev Tells the min amount out of a swap based on the current rate and decimals of the token
     * @param rate Current rate of the pool
     * @param decimals Decimals of the token
     */
    function _getMinAmountOut(uint256 rate, uint256 decimals) private pure returns (uint256) {
        return decimals <= 18 ? (rate / (10**(18 - decimals))) : (rate * (10**(decimals - 18)));
    }

    /**
     * @dev Tells the balances of a list of tokens
     */
    function _getBalances(IERC20[] memory tokens) private view returns (uint256[] memory balances) {
        balances = new uint256[](tokens.length);
        for (uint256 i = 0; i < tokens.length; i++) balances[i] = tokens[i].balanceOf(smartVault);
    }

    /**
     * @dev Tells the amounts out of a list of tokens and previous balances, and checks that they are above the
     * minimum amounts out
     */
    function _getAmountsOut(IERC20[] memory tokens, uint256[] memory preBalances, uint256[] memory minAmountsOut)
        private
        view
        returns (uint256[] memory amountsOut)
    {
        amountsOut = new uint256[](tokens.length);
        for (uint256 i = 0; i < tokens.length; i++) {
            uint256 postBalance = tokens[i].balanceOf(smartVault);
            uint256 amountOut = postBalance - preBalances[i];
            if (amountOut < minAmountsOut[i]) revert TaskBadAmountOut(amountOut, minAmountsOut[i]);
            amountsOut[i] = amountOut;
        }
    }
}
