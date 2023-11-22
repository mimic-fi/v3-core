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

import '@mimic-fi/v3-helpers/contracts/math/FixedPoint.sol';
import '@mimic-fi/v3-connectors/contracts/interfaces/balancer/IBalancerV2Vault.sol';
import '@mimic-fi/v3-connectors/contracts/interfaces/balancer/IBalancerV2PoolConnector.sol';

import '../../Task.sol';
import '../../interfaces/liquidity/balancer/IBalancerPool.sol';
import '../../interfaces/liquidity/balancer/IBalancerV2PoolExiter.sol';

/**
 * @title Balancer v2 pool exiter
 * @dev Task that offers the components to exit Balancer pools
 */
contract BalancerV2PoolExiter is IBalancerV2PoolExiter, Task {
    using FixedPoint for uint256;

    // Execution type for relayers
    bytes32 public constant override EXECUTION_TYPE = keccak256('BALANCER_V2_POOL_EXITER');

    // Task connector address
    address public override connector;

    // Default maximum slippage in fixed point
    uint256 public override defaultMaxSlippage;

    // Maximum slippage per token address
    mapping (address => uint256) public override customMaxSlippage;

    /**
     * @dev Custom max slippage config. Only used in the initializer.
     */
    struct CustomMaxSlippage {
        address token;
        uint256 maxSlippage;
    }

    /**
     * @dev Balancer pool exit config. Only used in the initializer.
     */
    struct BalancerPoolExitConfig {
        address connector;
        uint256 maxSlippage;
        CustomMaxSlippage[] customMaxSlippages;
        TaskConfig taskConfig;
    }

    /**
     * @dev Initializes a Balancer v2 pool exiter
     * @param config Balancer pool exit config
     */
    function initialize(BalancerPoolExitConfig memory config) external virtual initializer {
        __BalancerV2PoolExiter_init(config);
    }

    /**
     * @dev Initializes the Balancer v2 pool exiter. It does call upper contracts initializers.
     * @param config Balancer pool exit config
     */
    function __BalancerV2PoolExiter_init(BalancerPoolExitConfig memory config) internal onlyInitializing {
        __Task_init(config.taskConfig);
        __BalancerV2PoolExiter_init_unchained(config);
    }

    /**
     * @dev Initializes the Balancer v2 pool exiter. It does not call upper contracts initializers.
     * @param config Balancer pool exit config
     */
    function __BalancerV2PoolExiter_init_unchained(BalancerPoolExitConfig memory config) internal onlyInitializing {
        _setConnector(config.connector);
        _setDefaultMaxSlippage(config.maxSlippage);
        for (uint256 i = 0; i < config.customMaxSlippages.length; i++) {
            _setCustomMaxSlippage(config.customMaxSlippages[i].token, config.customMaxSlippages[i].maxSlippage);
        }
    }

    /**
     * @dev Tells the max slippage that should be used for a token
     */
    function getMaxSlippage(address token) public view virtual override returns (uint256) {
        uint256 maxSlippage = customMaxSlippage[token];
        return maxSlippage == 0 ? defaultMaxSlippage : maxSlippage;
    }

    /**
     * @dev Sets a new connector
     * @param newConnector Address of the connector to be set
     */
    function setConnector(address newConnector) external override authP(authParams(newConnector)) {
        _setConnector(newConnector);
    }

    /**
     * @dev Sets the default max slippage
     * @param maxSlippage Default max slippage to be set
     */
    function setDefaultMaxSlippage(uint256 maxSlippage) external override authP(authParams(maxSlippage)) {
        _setDefaultMaxSlippage(maxSlippage);
    }

    /**
     * @dev Sets a custom max slippage
     * @param token Address of the token to set a custom max slippage for
     * @param maxSlippage Max slippage to be set
     */
    function setCustomMaxSlippage(address token, uint256 maxSlippage)
        external
        override
        authP(authParams(token, maxSlippage))
    {
        _setCustomMaxSlippage(token, maxSlippage);
    }

    /**
     * @dev Execute Balancer v2 pool exiter
     * @param tokenIn Address of the Balancer pool token to exit
     * @param amountIn Amount of Balancer pool tokens to exit
     * @param slippage Slippage to be applied
     */
    function call(address tokenIn, uint256 amountIn, uint256 slippage)
        external
        override
        authP(authParams(tokenIn, amountIn, slippage))
    {
        if (amountIn == 0) amountIn = getTaskAmount(tokenIn);
        _beforeBalancerV2PoolExiter(tokenIn, amountIn, slippage);

        (address[] memory tokensOut, uint256[] memory minAmountsOut) = _getTokensOut(tokenIn, amountIn, slippage);
        bytes memory connectorData = abi.encodeWithSelector(
            IBalancerV2PoolConnector.exit.selector,
            tokenIn,
            amountIn,
            tokensOut,
            minAmountsOut
        );

        bytes memory result = ISmartVault(smartVault).execute(connector, connectorData);
        uint256[] memory amountsOut = abi.decode(result, (uint256[]));
        _afterBalancerV2PoolExiter(tokenIn, amountIn, tokensOut, amountsOut);
    }

    /**
     * @dev Tells the list of tokens and min amounts out based on a number of BPTs to exit
     * @param tokenIn Address of the pool being exited
     * @param amountIn Amount of tokens to exit the pool with
     * @param slippage Slippage to be used
     */
    function _getTokensOut(address tokenIn, uint256 amountIn, uint256 slippage)
        internal
        view
        returns (address[] memory tokensOut, uint256[] memory minAmountsOut)
    {
        uint256 bptTotalSupply = IERC20(tokenIn).totalSupply();
        uint256 bptRatio = amountIn.divDown(bptTotalSupply);

        bytes32 poolId = IBalancerPool(tokenIn).getPoolId();
        address balancerV2Vault = IBalancerV2PoolConnector(connector).balancerV2Vault();
        (IERC20[] memory tokens, uint256[] memory balances, ) = IBalancerV2Vault(balancerV2Vault).getPoolTokens(poolId);

        tokensOut = new address[](tokens.length);
        minAmountsOut = new uint256[](tokens.length);

        for (uint256 i = 0; i < tokens.length; i++) {
            tokensOut[i] = address(tokens[i]);
            uint256 expectedAmountsOut = balances[i].mulDown(bptRatio);
            minAmountsOut[i] = expectedAmountsOut.mulDown(FixedPoint.ONE - slippage);
        }
    }

    /**
     * @dev Before Balancer v2 pool exiter hook
     */
    function _beforeBalancerV2PoolExiter(address tokenIn, uint256 amountIn, uint256 slippage) internal virtual {
        _beforeTask(tokenIn, amountIn);
        if (tokenIn == address(0)) revert TaskTokenZero();
        if (amountIn == 0) revert TaskAmountZero();

        uint256 maxSlippage = getMaxSlippage(tokenIn);
        if (slippage > maxSlippage) revert TaskSlippageAboveMax(slippage, maxSlippage);
    }

    /**
     * @dev After Balancer v2 pool exiter hook
     */
    function _afterBalancerV2PoolExiter(
        address tokenIn,
        uint256 amountIn,
        address[] memory tokensOut,
        uint256[] memory amountsOut
    ) internal virtual {
        for (uint256 i = 0; i < tokensOut.length; i++) _increaseBalanceConnector(tokensOut[i], amountsOut[i]);
        _afterTask(tokenIn, amountIn);
    }

    /**
     * @dev Sets the task connector
     * @param newConnector New connector to be set
     */
    function _setConnector(address newConnector) internal {
        if (newConnector == address(0)) revert TaskConnectorZero();
        connector = newConnector;
        emit ConnectorSet(newConnector);
    }

    /**
     * @dev Sets the default max slippage
     * @param maxSlippage Default max slippage to be set
     */
    function _setDefaultMaxSlippage(uint256 maxSlippage) internal {
        if (maxSlippage > FixedPoint.ONE) revert TaskSlippageAboveOne();
        defaultMaxSlippage = maxSlippage;
        emit DefaultMaxSlippageSet(maxSlippage);
    }

    /**
     * @dev Sets a custom max slippage for a token
     * @param token Address of the token to set the custom max slippage for
     * @param maxSlippage Max slippage to be set
     */
    function _setCustomMaxSlippage(address token, uint256 maxSlippage) internal {
        if (token == address(0)) revert TaskTokenZero();
        if (maxSlippage > FixedPoint.ONE) revert TaskSlippageAboveOne();
        customMaxSlippage[token] = maxSlippage;
        emit CustomMaxSlippageSet(token, maxSlippage);
    }
}
