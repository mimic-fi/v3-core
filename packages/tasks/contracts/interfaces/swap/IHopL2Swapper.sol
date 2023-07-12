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
 * @dev L2 Hop swapper task interface
 */
interface IHopL2Swapper is IBaseSwapTask {
    /**
     * @dev Emitted every time an AMM is set for a token
     */
    event TokenAmmSet(address indexed token, address amm);

    /**
     * @dev Tells AMM set for a token
     */
    function tokenAmm(address token) external view returns (address);

    /**
     * @dev Sets an AMM for a hToken
     * @param hToken Address of the hToken to be set
     * @param amm AMM address to be set for the hToken
     */
    function setTokenAmm(address hToken, address amm) external;

    /**
     * @dev Executes the L2 hop swapper task
     */
    function call(address tokenIn, uint256 amountIn, uint256 slippage) external;
}
