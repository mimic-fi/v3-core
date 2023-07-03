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

import '../ITask.sol';

/**
 * @dev Base swap task interface
 */
interface IBaseSwapTask is ITask {
    /**
     * @dev Emitted every time the connector is set
     */
    event ConnectorSet(address indexed connector);

    /**
     * @dev Emitted every time the default token out is set
     */
    event DefaultTokenOutSet(address indexed tokenOut);

    /**
     * @dev Emitted every time the default max slippage is set
     */
    event DefaultMaxSlippageSet(uint256 maxSlippage);

    /**
     * @dev Emitted every time a custom token out is set
     */
    event CustomTokenOutSet(address indexed token, address tokenOut);

    /**
     * @dev Emitted every time a custom max slippage is set
     */
    event CustomMaxSlippageSet(address indexed token, uint256 maxSlippage);

    /**
     * @dev Tells the connector tied to the task
     */
    function connector() external view returns (address);

    /**
     * @dev Tells the default token out
     */
    function defaultTokenOut() external view returns (address);

    /**
     * @dev Tells the default max slippage
     */
    function defaultMaxSlippage() external view returns (uint256);

    /**
     * @dev Tells the token out defined for a specific token
     * @param token Address of the token being queried
     */
    function customTokenOut(address token) external view returns (address);

    /**
     * @dev Tells the max slippage defined for a specific token
     * @param token Address of the token being queried
     */
    function customMaxSlippage(address token) external view returns (uint256);

    /**
     * @dev Sets a new connector
     * @param newConnector Address of the connector to be set
     */
    function setConnector(address newConnector) external;

    /**
     * @dev Sets the default token out
     * @param tokenOut Address of the default token out to be set
     */
    function setDefaultTokenOut(address tokenOut) external;

    /**
     * @dev Sets the default max slippage
     * @param maxSlippage Default max slippage to be set
     */
    function setDefaultMaxSlippage(uint256 maxSlippage) external;

    /**
     * @dev Sets a custom token out
     * @param token Address of the token to set a custom token out for
     * @param tokenOut Address of the token out to be set
     */
    function setCustomTokenOut(address token, address tokenOut) external;

    /**
     * @dev Sets a custom max slippage
     * @param token Address of the token to set a custom max slippage for
     * @param maxSlippage Max slippage to be set
     */
    function setCustomMaxSlippage(address token, uint256 maxSlippage) external;
}
