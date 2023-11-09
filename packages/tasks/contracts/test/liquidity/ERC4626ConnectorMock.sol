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

contract ERC4626ConnectorMock {
    address public erc4626;

    address public getToken;

    event LogJoin(uint256 amount);

    event LogExit(uint256 amount);

    function setERC4626(address newERC4626) external {
        erc4626 = newERC4626;
    }

    function setToken(address newToken) external {
        getToken = newToken;
    }

    function join(uint256 assets) external returns (address, uint256) {
        emit LogJoin(assets);
        return (erc4626, assets);
    }

    function exit(uint256 shares) external returns (address, uint256) {
        emit LogExit(shares);
        return (getToken, shares);
    }
}
