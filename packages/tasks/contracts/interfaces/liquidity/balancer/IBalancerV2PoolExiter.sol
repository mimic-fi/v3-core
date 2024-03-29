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

import '../../ITask.sol';

/**
 * @dev Balancer V2 pool exit task interface
 */
interface IBalancerV2PoolExiter is ITask {
    /**
     * @dev The token is zero
     */
    error TaskTokenZero();

    /**
     * @dev The amount is zero
     */
    error TaskAmountZero();

    /**
     * @dev The connector is zero
     */
    error TaskConnectorZero();

    /**
     * @dev The slippage to be set is greater than one
     */
    error TaskSlippageAboveOne();

    /**
     * @dev The requested slippage is greater than the maximum slippage
     */
    error TaskSlippageAboveMax(uint256 slippage, uint256 maxSlippage);

    /**
     * @dev Emitted every time the connector is set
     */
    event ConnectorSet(address indexed connector);

    /**
     * @dev Emitted every time the default max slippage is set
     */
    event DefaultMaxSlippageSet(uint256 maxSlippage);

    /**
     * @dev Emitted every time a custom max slippage is set
     */
    event CustomMaxSlippageSet(address indexed token, uint256 maxSlippage);

    /**
     * @dev Tells the connector tied to the task
     */
    function connector() external view returns (address);

    /**
     * @dev Tells the default token threshold
     */
    function defaultMaxSlippage() external view returns (uint256);

    /**
     * @dev Tells the max slippage defined for a specific token
     * @param token Address of the token being queried
     */
    function customMaxSlippage(address token) external view returns (uint256);

    /**
     * @dev Tells the max slippage that should be used for a token
     */
    function getMaxSlippage(address token) external view returns (uint256);

    /**
     * @dev Sets a new connector
     * @param newConnector Address of the connector to be set
     */
    function setConnector(address newConnector) external;

    /**
     * @dev Sets the default max slippage
     * @param maxSlippage Default max slippage to be set
     */
    function setDefaultMaxSlippage(uint256 maxSlippage) external;

    /**
     * @dev Sets a custom max slippage
     * @param token Address of the token to set a custom max slippage for
     * @param maxSlippage Max slippage to be set
     */
    function setCustomMaxSlippage(address token, uint256 maxSlippage) external;

    /**
     * @dev Execute Balancer v2 pool exiter
     * @param tokenIn Address of the Balancer pool token to exit
     * @param amountIn Amount of Balancer pool tokens to exit
     * @param slippage Slippage to be applied
     */
    function call(address tokenIn, uint256 amountIn, uint256 slippage) external;
}
