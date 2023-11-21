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

import '../../utils/Arrays.sol';

library ArraysMock {
    function from1(address a, address b) external pure returns (address[] memory result) {
        return Arrays.from(a, b);
    }

    function from2(address a, address[] memory b, address c) external pure returns (address[] memory result) {
        return Arrays.from(a, b, c);
    }

    function from3(uint24 a, uint24[] memory b) external pure returns (uint24[] memory result) {
        return Arrays.from(a, b);
    }

    function from4(bytes32 a, bytes32[] memory b) external pure returns (bytes32[] memory result) {
        return Arrays.from(a, b);
    }
}
