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

// solhint-disable func-name-mixedcase

interface I2CrvPool is IERC20 {
    function get_virtual_price() external view returns (uint256);

    function coins(uint256 index) external view returns (address);

    function exchange(int128 i, int128 j, uint256 dx, uint256 minDy) external;

    function add_liquidity(uint256[2] memory amountsIn, uint256 minAmountOut) external returns (uint256);

    function remove_liquidity_one_coin(uint256 amountIn, int128 index, uint256 minAmountOut) external returns (uint256);
}
