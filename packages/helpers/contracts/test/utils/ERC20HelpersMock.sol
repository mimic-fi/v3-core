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

import '../../utils/ERC20Helpers.sol';

contract ERC20HelpersMock {
    receive() external payable {
        // solhint-disable-previous-line no-empty-blocks
    }

    function approve(address token, address to, uint256 amount) external {
        ERC20Helpers.approve(token, to, amount);
    }

    function transfer(address token, address to, uint256 amount) external {
        ERC20Helpers.transfer(token, to, amount);
    }

    function balanceOf(address token, address account) external view returns (uint256) {
        return ERC20Helpers.balanceOf(token, account);
    }
}
