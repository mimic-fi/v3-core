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

import '@openzeppelin/contracts/utils/cryptography/ECDSA.sol';

import '@mimic-fi/v3-helpers/contracts/math/FixedPoint.sol';
import '@mimic-fi/v3-helpers/contracts/utils/BytesHelpers.sol';
import '@mimic-fi/v3-connectors/contracts/interfaces/swap/IParaswapV5Connector.sol';

import './BaseSwapTask.sol';
import '../interfaces/swap/IParaswapV5Swapper.sol';

/**
 * @title Paraswap V5 swapper task
 * @dev Task that extends the swapper task to use Paraswap v5
 */
contract ParaswapV5Swapper is IParaswapV5Swapper, BaseSwapTask {
    using FixedPoint for uint256;
    using BytesHelpers for bytes;

    // Execution type for relayers
    bytes32 public constant override EXECUTION_TYPE = keccak256('PARASWAP_V5_SWAPPER');

    // Address of the Paraswap quote signer
    address public override quoteSigner;

    /**
     * @dev Paraswap v5 swap config. Only used in the initializer.
     */
    struct ParaswapV5SwapConfig {
        address quoteSigner;
        BaseSwapConfig baseSwapConfig;
    }

    /**
     * @dev Initializes the Paraswap v5 swapper
     * @param config Paraswap v5 swap config
     */
    function initialize(ParaswapV5SwapConfig memory config) external virtual initializer {
        __ParaswapV5Swapper_init(config);
    }

    /**
     * @dev Initializes the Paraswap v5 swapper. It does call upper contracts initializers.
     * @param config Paraswap v5 swap config
     */
    function __ParaswapV5Swapper_init(ParaswapV5SwapConfig memory config) internal onlyInitializing {
        __BaseSwapTask_init(config.baseSwapConfig);
        __ParaswapV5Swapper_init_unchained(config);
    }

    /**
     * @dev Initializes the Paraswap v5 swapper. It does not call upper contracts initializers.
     * @param config Paraswap v5 swap config
     */
    function __ParaswapV5Swapper_init_unchained(ParaswapV5SwapConfig memory config) internal onlyInitializing {
        _setQuoteSigner(config.quoteSigner);
    }

    /**
     * @dev Sets the quote signer address
     * @param newQuoteSigner Address of the new quote signer to be set
     */
    function setQuoteSigner(address newQuoteSigner) external override authP(authParams(newQuoteSigner)) {
        _setQuoteSigner(newQuoteSigner);
    }

    /**
     * @dev Execute Paraswap v5 swapper task
     */
    function call(
        address tokenIn,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 expectedAmountOut,
        uint256 deadline,
        bytes memory data,
        bytes memory sig
    ) external override authP(authParams(tokenIn, amountIn, minAmountOut, expectedAmountOut, deadline)) {
        if (amountIn == 0) amountIn = getTaskAmount(tokenIn);
        address tokenOut = getTokenOut(tokenIn);
        uint256 slippage = FixedPoint.ONE - minAmountOut.divUp(expectedAmountOut);
        _beforeParaswapV5Swapper(
            tokenIn,
            tokenOut,
            amountIn,
            slippage,
            minAmountOut,
            expectedAmountOut,
            deadline,
            data,
            sig
        );

        bytes memory connectorData = abi.encodeWithSelector(
            IParaswapV5Connector.execute.selector,
            tokenIn,
            tokenOut,
            amountIn,
            minAmountOut,
            data
        );

        bytes memory result = ISmartVault(smartVault).execute(connector, connectorData);
        _afterParaswapV5Swapper(tokenIn, amountIn, slippage, tokenOut, result.toUint256());
    }

    /**
     * @dev Before Paraswap v5 swapper hook
     */
    function _beforeParaswapV5Swapper(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 slippage,
        uint256 minAmountOut,
        uint256 expectedAmountOut,
        uint256 deadline,
        bytes memory data,
        bytes memory sig
    ) internal virtual {
        _beforeBaseSwapTask(tokenIn, amountIn, slippage);
        bool isBuy = false;
        bytes32 message = keccak256(
            abi.encodePacked(tokenIn, tokenOut, isBuy, amountIn, minAmountOut, expectedAmountOut, deadline, data)
        );
        address signer = ECDSA.recover(ECDSA.toEthSignedMessageHash(message), sig);
        if (signer != quoteSigner) revert TaskInvalidQuoteSigner(signer, quoteSigner);
        if (block.timestamp > deadline) revert TaskQuoteSignerPastDeadline(deadline, block.timestamp);
    }

    /**
     * @dev After Paraswap v5 swapper hook
     */
    function _afterParaswapV5Swapper(
        address tokenIn,
        uint256 amountIn,
        uint256 slippage,
        address tokenOut,
        uint256 amountOut
    ) internal virtual {
        _afterBaseSwapTask(tokenIn, amountIn, slippage, tokenOut, amountOut);
    }

    /**
     * @dev Sets the quote signer address
     * @param newQuoteSigner Address of the new quote signer to be set
     */
    function _setQuoteSigner(address newQuoteSigner) internal {
        if (newQuoteSigner == address(0)) revert TaskQuoteSignerZero();
        quoteSigner = newQuoteSigner;
        emit QuoteSignerSet(newQuoteSigner);
    }
}
