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

import './IBaseBridgeTask.sol';

/**
 * @dev Hop bridger task interface
 */
interface IHopBridger is IBaseBridgeTask {
    /**
     * @dev Emitted every time the relayer is set
     */
    event RelayerSet(address indexed relayer);

    /**
     * @dev Emitted every time the max deadline is set
     */
    event MaxDeadlineSet(uint256 maxDeadline);

    /**
     * @dev Emitted every time the default max fee percentage is set
     */
    event DefaultMaxFeePctSet(uint256 maxFeePct);

    /**
     * @dev Emitted every time the default max slippage is set
     */
    event DefaultMaxSlippageSet(uint256 maxSlippage);

    /**
     * @dev Emitted every time a custom max fee percentage is set
     */
    event CustomMaxFeePctSet(address indexed token, uint256 maxFeePct);

    /**
     * @dev Emitted every time a custom max slippage is set
     */
    event CustomMaxSlippageSet(address indexed token, uint256 maxSlippage);

    /**
     * @dev Emitted every time a Hop entrypoint is set for a token
     */
    event TokenHopEntrypointSet(address indexed token, address indexed entrypoint);

    /**
     * @dev Tells the relayer address, only used when bridging from L1 to L2
     */
    function relayer() external view returns (address);

    /**
     * @dev Tells the max deadline
     */
    function maxDeadline() external view returns (uint256);

    /**
     * @dev Tells the default token threshold
     */
    function defaultMaxSlippage() external view returns (uint256);

    /**
     * @dev Tells the default max fee pct
     */
    function defaultMaxFeePct() external view returns (uint256);

    /**
     * @dev Tells the max fee percentage defined for a specific token
     */
    function getCustomMaxFeePct(address token) external view returns (bool exists, uint256 maxFeePct);

    /**
     * @dev Tells the max slippage defined for a specific token
     */
    function getCustomMaxSlippage(address token) external view returns (bool exists, uint256 maxSlippage);

    /**
     * @dev Tells Hop entrypoint set for a token
     */
    function getTokenHopEntrypoint(address token) external view returns (bool exists, address entrypoint);

    /**
     * @dev Sets the relayer, only used when bridging from L1 to L2
     * @param relayer New relayer address to be set
     */
    function setRelayer(address relayer) external;

    /**
     * @dev Sets the max deadline
     * @param maxDeadline New max deadline to be set
     */
    function setMaxDeadline(uint256 maxDeadline) external;

    /**
     * @dev Sets the default max fee percentage
     * @param maxFeePct New default max fee percentage to be set
     */
    function setDefaultMaxFeePct(uint256 maxFeePct) external;

    /**
     * @dev Sets the default max slippage
     * @param maxSlippage New default max slippage to be set
     */
    function setDefaultMaxSlippage(uint256 maxSlippage) external;

    /**
     * @dev Sets a custom max fee percentage
     * @param token Token address to set a max fee percentage for
     * @param maxFeePct Max fee percentage to be set for a token
     */
    function setCustomMaxFeePct(address token, uint256 maxFeePct) external;

    /**
     * @dev Sets a custom max slippage
     * @param token Token address to set a max slippage for
     * @param maxSlippage Max slippage to be set for a token
     */
    function setCustomMaxSlippage(address token, uint256 maxSlippage) external;

    /**
     * @dev Sets an entrypoint for a tokens
     * @param token Token address to set a Hop entrypoint for
     * @param entrypoint Hop entrypoint address to be set for a token
     */
    function setTokenHopEntrypoint(address token, address entrypoint) external;

    /**
     * @dev Execution function
     */
    function call(address token, uint256 amountIn, uint256 slippage, uint256 fee) external;
}
