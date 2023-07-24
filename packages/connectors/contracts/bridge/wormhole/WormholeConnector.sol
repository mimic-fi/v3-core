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

import '@mimic-fi/v3-helpers/contracts/utils/ERC20Helpers.sol';

import './IWormhole.sol';

/**
 * @title WormholeConnector
 * @dev Interfaces with Wormhole to bridge tokens through CCTP
 */
contract WormholeConnector {
    /**
     * @dev The chain ID is the same of the current chain
     */
    error WormholeBridgeSameChain(uint256 chainId);

    /**
     * @dev The recipient address is zero
     */
    error WormholeBridgeRecipientZero();

    /**
     * @dev The relayer fee is greater than the amount to be bridged
     */
    error WormholeBridgeRelayerFeeGTAmount(uint256 relayerFee, uint256 amountIn);

    /**
     * @dev The minimum amount out is greater than the amount to be bridged minus the relayer fee
     */
    error WormholeBridgeMinAmountOutTooBig(uint256 minAmountOut, uint256 amountIn, uint256 relayerFee);

    /**
     * @dev The token balance after the bridge is less than the token balance before the bridge minus the amount bridged
     */
    error WormholeBridgeBadTokenInBalance(uint256 postBalanceIn, uint256 preBalanceIn, uint256 amountIn);

    /**
     * @dev The chain ID is not supported
     */
    error WormholeBridgeUnknownChainId(uint256 chainId);

    // List of Wormhole network IDs
    uint16 private constant ETHEREUM_WORMHOLE_NETWORK_ID = 2;
    uint16 private constant POLYGON_WORMHOLE_NETWORK_ID = 5;
    uint16 private constant ARBITRUM_WORMHOLE_NETWORK_ID = 23;
    uint16 private constant OPTIMISM_WORMHOLE_NETWORK_ID = 24;
    uint16 private constant BSC_WORMHOLE_NETWORK_ID = 4;
    uint16 private constant FANTOM_WORMHOLE_NETWORK_ID = 10;
    uint16 private constant AVALANCHE_WORMHOLE_NETWORK_ID = 6;

    // List of chain IDs supported by Wormhole
    uint256 private constant ETHEREUM_ID = 1;
    uint256 private constant POLYGON_ID = 137;
    uint256 private constant ARBITRUM_ID = 42161;
    uint256 private constant OPTIMISM_ID = 10;
    uint256 private constant BSC_ID = 56;
    uint256 private constant FANTOM_ID = 250;
    uint256 private constant AVALANCHE_ID = 43114;

    // Reference to the Wormhole's CircleRelayer contract of the source chain
    IWormhole public immutable wormholeCircleRelayer;

    /**
     * @dev Creates a new Wormhole connector
     * @param _wormholeCircleRelayer Address of the Wormhole's CircleRelayer contract for the source chain
     */
    constructor(address _wormholeCircleRelayer) {
        wormholeCircleRelayer = IWormhole(_wormholeCircleRelayer);
    }

    /**
     * @dev Executes a bridge of assets using Wormhole's CircleRelayer integration
     * @param chainId ID of the destination chain
     * @param token Address of the token to be bridged
     * @param amountIn Amount of tokens to be bridged
     * @param minAmountOut Minimum amount of tokens willing to receive on the destination chain after relayer fees
     * @param recipient Address that will receive the tokens on the destination chain
     */
    function execute(uint256 chainId, address token, uint256 amountIn, uint256 minAmountOut, address recipient)
        external
    {
        if (block.chainid == chainId) revert WormholeBridgeSameChain(chainId);
        if (recipient == address(0)) revert WormholeBridgeRecipientZero();

        uint16 wormholeNetworkId = _getWormholeNetworkId(chainId);
        uint256 relayerFee = wormholeCircleRelayer.relayerFee(wormholeNetworkId, token);
        if (relayerFee > amountIn) revert WormholeBridgeRelayerFeeGTAmount(relayerFee, amountIn);
        if (minAmountOut > amountIn - relayerFee)
            revert WormholeBridgeMinAmountOutTooBig(minAmountOut, amountIn, relayerFee);

        uint256 preBalanceIn = IERC20(token).balanceOf(address(this));

        ERC20Helpers.approve(token, address(wormholeCircleRelayer), amountIn);
        wormholeCircleRelayer.transferTokensWithRelay(
            token,
            amountIn,
            0, // don't swap to native token
            wormholeNetworkId,
            bytes32(uint256(uint160(recipient))) // convert from address to bytes32
        );

        uint256 postBalanceIn = IERC20(token).balanceOf(address(this));
        if (postBalanceIn < preBalanceIn - amountIn)
            revert WormholeBridgeBadTokenInBalance(postBalanceIn, preBalanceIn, amountIn);
    }

    /**
     * @dev Tells the Wormhole network ID based on a chain ID
     * @param chainId ID of the chain being queried
     * @return Wormhole network ID associated with the requested chain ID
     */
    function _getWormholeNetworkId(uint256 chainId) internal pure returns (uint16) {
        if (chainId == ETHEREUM_ID) return ETHEREUM_WORMHOLE_NETWORK_ID;
        else if (chainId == POLYGON_ID) return POLYGON_WORMHOLE_NETWORK_ID;
        else if (chainId == ARBITRUM_ID) return ARBITRUM_WORMHOLE_NETWORK_ID;
        else if (chainId == OPTIMISM_ID) return OPTIMISM_WORMHOLE_NETWORK_ID;
        else if (chainId == BSC_ID) return BSC_WORMHOLE_NETWORK_ID;
        else if (chainId == FANTOM_ID) return FANTOM_WORMHOLE_NETWORK_ID;
        else if (chainId == AVALANCHE_ID) return AVALANCHE_WORMHOLE_NETWORK_ID;
        else revert WormholeBridgeUnknownChainId(chainId);
    }
}
