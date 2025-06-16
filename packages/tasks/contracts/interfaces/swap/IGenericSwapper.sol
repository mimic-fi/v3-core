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

import './IBaseSwapTask.sol';

/**
 * @dev Generic swapper task interface
 */
interface IGenericSwapper is IBaseSwapTask {
    /**
     * @dev The swap target is zero
     */
    error TaskSwapTargetZero();

    /**
     * @dev The swap target requested is not allowed
     */
    error TaskSwapTargetNotAllowed();

    /**
     * @dev The swap targets inputs length mismatch
     */
    error TaskTargetSetInputLengthMismatch();

    /**
     * @dev Emitted every time a swap target allowance is set
     */
    event SwapTargetSet(address indexed target, bool allowed);

    /**
     * @dev Tells whether a swap target is allowed
     */
    function isTargetAllowed(address target) external view returns (bool);

    /**
     * @dev Execution function
     */
    function call(address tokenIn, uint256 amountIn, uint256 slippage, address target, bytes memory data) external;
}
