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
import '@mimic-fi/v3-helpers/contracts/math/UncheckedMath.sol';
import '@mimic-fi/v3-helpers/contracts/utils/Denominations.sol';
import '@mimic-fi/v3-helpers/contracts/utils/ERC20Helpers.sol';
import '@mimic-fi/v3-helpers/contracts/utils/IWrappedNativeToken.sol';

import './IHopL2AMM.sol';
import './IHopL1Bridge.sol';

/**
 * @title HopConnector
 * @dev Interfaces with Hop Exchange to bridge tokens
 */
contract HopConnector {
    using FixedPoint for uint256;
    using UncheckedMath for uint256;
    using Denominations for address;

    // Ethereum mainnet chain ID = 1
    uint256 private constant MAINNET_CHAIN_ID = 1;

    // Goerli chain ID = 5
    uint256 private constant GOERLI_CHAIN_ID = 5;

    // Wrapped native token reference
    address public immutable wrappedNativeToken;

    /**
     * @dev Initializes the HopConnector contract
     * @param _wrappedNativeToken Address of the wrapped native token
     */
    constructor(address _wrappedNativeToken) {
        wrappedNativeToken = _wrappedNativeToken;
    }

    /**
     * @dev It allows receiving native token transfers
     */
    receive() external payable {
        // solhint-disable-previous-line no-empty-blocks
    }

    /**
     * @dev Executes a bridge of assets using Hop Exchange
     * @param chainId ID of the destination chain
     * @param token Address of the token to be bridged
     * @param amountIn Amount of tokens to be bridged
     * @param minAmountOut Minimum amount of tokens willing to receive on the destination chain
     * @param recipient Address that will receive the tokens on the destination chain
     * @param bridge Address of the bridge component (i.e. hopBridge or hopAMM)
     * @param deadline Deadline to be applied if the destination is L2 when swapping the hToken for the token to be bridged
     * @param relayer Only used when transfering from L1 to L2 if a 3rd party is relaying the transfer on the user's behalf
     * @param fee Fee to be sent to the bridge based on the source and destination chain (i.e. relayerFee or bonderFee)
     */
    function execute(
        uint256 chainId,
        address token,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient,
        address bridge,
        uint256 deadline,
        address relayer,
        uint256 fee
    ) external {
        require(block.chainid != chainId, 'HOP_BRIDGE_SAME_CHAIN');
        require(recipient != address(0), 'HOP_BRIDGE_RECIPIENT_ZERO');

        bool toL2 = !_isL1(chainId);
        bool fromL1 = _isL1(block.chainid);

        uint256 preBalanceIn = IERC20(token).balanceOf(address(this));

        if (fromL1 && toL2)
            _bridgeFromL1ToL2(chainId, token, amountIn, minAmountOut, recipient, bridge, deadline, relayer, fee);
        else if (!fromL1 && toL2)
            _bridgeFromL2ToL2(chainId, token, amountIn, minAmountOut, recipient, bridge, deadline, fee);
        else if (!fromL1 && !toL2) _bridgeFromL2ToL1(chainId, token, amountIn, minAmountOut, recipient, bridge, fee);
        else revert('HOP_BRIDGE_OP_NOT_SUPPORTED');

        uint256 postBalanceIn = IERC20(token).balanceOf(address(this));
        require(postBalanceIn >= preBalanceIn - amountIn, 'HOP_BAD_TOKEN_IN_BALANCE');
    }

    /**
     * @dev Internal function to bridge assets from L1 to L2
     * @param chainId ID of the destination chain
     * @param token Address of the token to be bridged
     * @param amountIn Amount of tokens to be bridged
     * @param minAmountOut Minimum amount of tokens willing to receive on the destination chain
     * @param recipient Address that will receive the tokens on the destination chain
     * @param hopBridge Address of the Hop bridge corresponding to the token to be bridged
     * @param deadline Deadline to be applied on L2 when swapping the hToken for the token to be bridged
     * @param relayer Only used if a 3rd party is relaying the transfer on the user's behalf
     * @param relayerFee Only used if a 3rd party is relaying the transfer on the user's behalf
     */
    function _bridgeFromL1ToL2(
        uint256 chainId,
        address token,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient,
        address hopBridge,
        uint256 deadline,
        address relayer,
        uint256 relayerFee
    ) internal {
        require(deadline > block.timestamp, 'HOP_BRIDGE_INVALID_DEADLINE');

        uint256 value = _unwrapOrApproveTokens(hopBridge, token, amountIn);
        IHopL1Bridge(hopBridge).sendToL2{ value: value }(
            chainId,
            recipient,
            amountIn,
            minAmountOut,
            deadline,
            relayer,
            relayerFee
        );
    }

    /**
     * @dev Internal function to bridge assets from L2 to L1
     * @param chainId ID of the destination chain
     * @param token Address of the token to be bridged
     * @param amountIn Amount of tokens to be bridged
     * @param minAmountOut Minimum amount of tokens willing to receive on the destination chain
     * @param recipient Address that will receive the tokens on the destination chain
     * @param hopAMM Address of the Hop AMM corresponding to the token to be bridged
     * @param bonderFee Must be computed using the Hop SDK or API
     */
    function _bridgeFromL2ToL1(
        uint256 chainId,
        address token,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient,
        address hopAMM,
        uint256 bonderFee
    ) internal {
        uint256 value = _unwrapOrApproveTokens(hopAMM, token, amountIn);
        // No destination min amount nor deadline needed since there is no AMM on L1
        IHopL2AMM(hopAMM).swapAndSend{ value: value }(
            chainId,
            recipient,
            amountIn,
            bonderFee,
            minAmountOut,
            block.timestamp,
            0,
            0
        );
    }

    /**
     * @dev Internal function to bridge assets from L2 to L2
     * @param chainId ID of the destination chain
     * @param token Address of the token to be bridged
     * @param amountIn Amount of tokens to be bridged
     * @param minAmountOut Minimum amount of tokens willing to receive on the destination chain
     * @param recipient Address that will receive the tokens on the destination chain
     * @param hopAMM Address of the Hop AMM corresponding to the token to be bridged
     * @param deadline Deadline to be applied on the destination L2 when swapping the hToken for the token to be bridged
     * @param bonderFee Must be computed using the Hop SDK or API
     */
    function _bridgeFromL2ToL2(
        uint256 chainId,
        address token,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient,
        address hopAMM,
        uint256 deadline,
        uint256 bonderFee
    ) internal {
        require(deadline > block.timestamp, 'HOP_BRIDGE_INVALID_DEADLINE');

        uint256 intermediateMinAmountOut = amountIn - ((amountIn - minAmountOut) / 2);
        IHopL2AMM(hopAMM).swapAndSend{ value: _unwrapOrApproveTokens(hopAMM, token, amountIn) }(
            chainId,
            recipient,
            amountIn,
            bonderFee,
            intermediateMinAmountOut,
            block.timestamp,
            minAmountOut,
            deadline
        );
    }

    /**
     * @dev Unwraps or approves the given amount of tokens depending on the token being bridged
     * @param bridge Address of the bridge component to approve the tokens to
     * @param token Address of the token to be bridged
     * @param amount Amount of tokens to be bridged
     * @return value Value that must be used to perform a bridge op
     */
    function _unwrapOrApproveTokens(address bridge, address token, uint256 amount) internal returns (uint256 value) {
        if (token == wrappedNativeToken) {
            value = amount;
            IWrappedNativeToken(token).withdraw(amount);
        } else {
            value = 0;
            ERC20Helpers.approve(token, bridge, amount);
        }
    }

    /**
     * @dev Tells if a chain ID refers to L1 or not: currently only Ethereum Mainnet or Goerli
     * @param chainId ID of the chain being queried
     */
    function _isL1(uint256 chainId) internal pure returns (bool) {
        return chainId == MAINNET_CHAIN_ID || chainId == GOERLI_CHAIN_ID;
    }
}
