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
 * @dev BPT exiter task interface
 */
interface IBalancerBPTExiter is ITask {
    /**
     * @dev The token is zero
     */
    error TaskTokenZero();

    /**
     * @dev The amount is zero
     */
    error TaskAmountZero();

    /**
     * @dev The post balance is lower than the pre balance
     */
    error TaskPostBalanceUnexpected(uint256 postBalance, uint256 preBalance);

    /**
     * @dev The amount out is lower than the minimum amount out
     */
    error TaskBadAmountOut(uint256 amountOut, uint256 minAmountOut);

    /**
     * @dev Tells the address of the Balancer vault. It cannot be changed.
     */
    function balancerVault() external returns (address);

    /**
     * @dev Execute Balancer BPT exiter
     */
    function call(address token, uint256 amount) external;
}
