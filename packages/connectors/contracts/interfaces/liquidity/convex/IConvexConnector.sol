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

/**
 * @title Convex connector interface
 */
interface IConvexConnector {
    /**
     * @dev Missing Convex pool for the requested Curve pool
     */
    error ConvexCvxPoolNotFound(address curvePool);

    /**
     * @dev Failed to deposit tokens into the Convex booster
     */
    error ConvexBoosterDepositFailed(uint256 poolId, uint256 amount);

    /**
     * @dev Failed to withdraw tokens from Convex pool
     */
    error ConvexCvxPoolWithdrawFailed(address cvxPool, uint256 amount);

    /**
     * @dev Tells the reference to the Convex booster
     */
    function booster() external view returns (address);

    /**
     * @dev Finds the Curve pool address associated to a Convex pool
     */
    function getCurvePool(address cvxPool) external view returns (address);

    /**
     * @dev Finds the Curve pool address associated to a Convex pool
     */
    function getCvxPool(address curvePool) external view returns (address);

    /**
     * @dev Claims Convex pool rewards for a Curve pool
     */
    function claim(address cvxPool) external returns (address[] memory tokens, uint256[] memory amounts);

    /**
     * @dev Deposits Curve pool tokens into Convex
     * @param curvePool Address of the Curve pool to join Convex
     * @param amount Amount of Curve pool tokens to be deposited into Convex
     */
    function join(address curvePool, uint256 amount) external returns (uint256);

    /**
     * @dev Withdraws Curve pool tokens from Convex
     * @param cvxPool Address of the Convex pool to exit from Convex
     * @param amount Amount of Convex tokens to be withdrawn
     */
    function exit(address cvxPool, uint256 amount) external returns (uint256);
}
