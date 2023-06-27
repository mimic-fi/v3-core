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
import '@mimic-fi/v3-connectors/contracts/swap/paraswap-v5/ParaswapV5Connector.sol';

import './BaseSwapTask.sol';
import './interfaces/IParaswapV5Swapper.sol';

/**
 * @title Paraswap V5 swapper task
 * @dev Task that extends the swapper task to use Paraswap v5
 */
contract ParaswapV5Swapper is IParaswapV5Swapper, BaseSwapTask {
    using FixedPoint for uint256;

    // Address of the Paraswap quote signer
    address public override quoteSigner;

    /**
     * @dev Paraswap v5 swapper task config
     */
    struct Paraswap5SwapperConfig {
        address quoteSigner;
        BaseSwapConfig baseSwapConfig;
    }

    /**
     * @dev Creates a paraswap v5 swapper task
     */
    function initialize(Paraswap5SwapperConfig memory config) external initializer {
        _initialize(config.baseSwapConfig);
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
    )
        external
        override
        authP(authParams(tokenIn, amountIn))
        baseSwapTaskCall(tokenIn, amountIn, FixedPoint.ONE - minAmountOut.divUp(expectedAmountOut))
    {
        address tokenOut = _getApplicableTokenOut(tokenIn);
        _validateQuoteSigner(tokenIn, tokenOut, amountIn, minAmountOut, expectedAmountOut, deadline, data, sig);

        bytes memory connectorData = abi.encodeWithSelector(
            ParaswapV5Connector.execute.selector,
            tokenIn,
            tokenOut,
            amountIn,
            minAmountOut,
            data
        );

        ISmartVault(smartVault).execute(connector, connectorData);
    }

    /**
     * @dev Reverts if the quote was signed by someone else than the quote signer or if its expired
     */
    function _validateQuoteSigner(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 expectedAmountOut,
        uint256 deadline,
        bytes memory data,
        bytes memory sig
    ) internal view {
        bytes32 message = _hash(tokenIn, tokenOut, amountIn, minAmountOut, expectedAmountOut, deadline, data);
        address signer = ECDSA.recover(ECDSA.toEthSignedMessageHash(message), sig);
        require(signer == quoteSigner, 'TASK_INVALID_QUOTE_SIGNER');
        require(block.timestamp <= deadline, 'TASK_QUOTE_SIGNER_DEADLINE');
    }

    /**
     * @dev Sets the quote signer address
     * @param newQuoteSigner Address of the new quote signer to be set
     */
    function _setQuoteSigner(address newQuoteSigner) internal {
        require(newQuoteSigner != address(0), 'TASK_QUOTE_SIGNER_ZERO');
        quoteSigner = newQuoteSigner;
        emit QuoteSignerSet(newQuoteSigner);
    }

    /**
     * @dev Builds the quote message to check the signature of the quote signer
     */
    function _hash(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 expectedAmountOut,
        uint256 deadline,
        bytes memory data
    ) private pure returns (bytes32) {
        bool isBuy = false;
        return
            keccak256(
                abi.encodePacked(tokenIn, tokenOut, isBuy, amountIn, minAmountOut, expectedAmountOut, deadline, data)
            );
    }
}
