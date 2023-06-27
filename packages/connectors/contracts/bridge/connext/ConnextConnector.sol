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

import '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';

import '@mimic-fi/v3-helpers/contracts/utils/ERC20Helpers.sol';

import './IConnext.sol';

/**
 * @title ConnextConnector
 * @dev Interfaces with Connext to bridge tokens
 */
contract ConnextConnector {
    // List of chain domains supported by Connext
    uint32 private constant ETHEREUM_DOMAIN = 6648936;
    uint32 private constant POLYGON_DOMAIN = 1886350457;
    uint32 private constant ARBITRUM_DOMAIN = 1634886255;
    uint32 private constant OPTIMISM_DOMAIN = 1869640809;
    uint32 private constant GNOSIS_DOMAIN = 6778479;
    uint32 private constant BSC_DOMAIN = 6450786;

    // List of chain IDs supported by Connext
    uint256 private constant ETHEREUM_ID = 1;
    uint256 private constant POLYGON_ID = 137;
    uint256 private constant ARBITRUM_ID = 42161;
    uint256 private constant OPTIMISM_ID = 10;
    uint256 private constant GNOSIS_ID = 100;
    uint256 private constant BSC_ID = 56;

    // Reference to the Connext contract of the source chain
    IConnext public immutable connext;

    /**
     * @dev Creates a new Connext connector
     * @param _connext Address of the Connext contract for the source chain
     */
    constructor(address _connext) {
        connext = IConnext(_connext);
    }

    /**
     * @dev Executes a bridge of assets using Connext
     * @param chainId ID of the destination chain
     * @param token Address of the token to be bridged
     * @param amountIn Amount of tokens to be bridged
     * @param recipient Address that will receive the tokens on the destination chain
     * @param relayerFee Fee to be paid to the relayer
     */
    function execute(
        uint256 chainId,
        address token,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient,
        uint256 relayerFee
    ) external {
        require(block.chainid != chainId, 'CONNEXT_BRIDGE_SAME_CHAIN');
        require(recipient != address(0), 'CONNEXT_BRIDGE_RECIPIENT_ZERO');
        require(minAmountOut <= amountIn, 'CONNEXT_MIN_AMOUNT_GT_AMOUNT_IN');
        require(relayerFee <= minAmountOut, 'CONNEXT_RELAYER_FEE_GT_MIN_AMT');

        uint32 domain = _getChainDomain(chainId);
        // We validated `minAmountOut` is lower than or equal to `amountIn`, then we can compute slippage in BPS (e.g. 30 = 0.3%)
        uint256 slippage = 100 - ((minAmountOut * 100) / amountIn);
        uint256 amountInAfterFees = amountIn - relayerFee;

        uint256 preBalanceIn = IERC20(token).balanceOf(address(this));

        ERC20Helpers.approve(token, address(connext), amountIn);
        connext.xcall(
            domain,
            recipient,
            token,
            address(this), // This is the delegate address, the one that will be able to act in case the bridge fails
            amountInAfterFees,
            slippage,
            new bytes(0), // No call on the destination chain needed
            relayerFee
        );

        uint256 postBalanceIn = IERC20(token).balanceOf(address(this));
        require(postBalanceIn >= preBalanceIn - amountIn, 'CONNEXT_BAD_TOKEN_IN_BALANCE');
    }

    /**
     * @dev Tells the chain domain based on a chain ID
     * @param chainId ID of the chain being queried
     * @return Chain domain associated to the requested chain ID
     */
    function _getChainDomain(uint256 chainId) internal pure returns (uint32) {
        if (chainId == ETHEREUM_ID) return ETHEREUM_DOMAIN;
        else if (chainId == POLYGON_ID) return POLYGON_DOMAIN;
        else if (chainId == ARBITRUM_ID) return ARBITRUM_DOMAIN;
        else if (chainId == OPTIMISM_ID) return OPTIMISM_DOMAIN;
        else if (chainId == GNOSIS_ID) return GNOSIS_DOMAIN;
        else if (chainId == BSC_ID) return BSC_DOMAIN;
        else revert('CONNEXT_UNKNOWN_CHAIN_ID');
    }
}
