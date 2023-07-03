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

contract Curve2CrvConnectorMock {
    event LogJoin(address tokenIn, uint256 amountIn, uint256 slippage);

    event LogExit(uint256 amountIn, address tokenOut, uint256 slippage);

    function join(address tokenIn, uint256 amountIn, uint256 slippage) external {
        emit LogJoin(tokenIn, amountIn, slippage);
    }

    function exit(uint256 amountIn, address tokenOut, uint256 slippage) external {
        emit LogExit(amountIn, tokenOut, slippage);
    }
}
