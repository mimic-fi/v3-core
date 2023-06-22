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

import '../../utils/BytesHelpers.sol';

library BytesHelpersMock {
    function concat1(bytes memory self, address value) external pure returns (bytes memory) {
        return BytesHelpers.concat(self, value);
    }

    function concat2(bytes memory self, uint24 value) external pure returns (bytes memory) {
        return BytesHelpers.concat(self, value);
    }

    function toUint256(bytes memory self, uint256 start) external pure returns (uint256) {
        return BytesHelpers.toUint256(self, start);
    }
}
