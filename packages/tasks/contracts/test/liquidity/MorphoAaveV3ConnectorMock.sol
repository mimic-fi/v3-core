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

contract MorphoAaveV3ConnectorMock {
    event LogClaim(address token, uint256 amount);

    event LogJoin(address token, uint256 amount);

    event LogExit(address token, uint256 amount);

    address private constant MORPHO_TOKEN = 0x9994E35Db50125E0DF82e4c2dde62496CE330999;

    function claim(uint256 amount, bytes32[] calldata)
        external
        returns (address[] memory tokens, uint256[] memory amounts)
    {
        emit LogClaim(MORPHO_TOKEN, amount);
        amounts = new uint256[](1);
        amounts[0] = amount;
        tokens = new address[](1);
        tokens[0] = MORPHO_TOKEN;
    }

    function join(address token, uint256 amount, uint256) external returns (uint256) {
        emit LogJoin(token, amount);
        return amount;
    }

    function exit(address token, uint256 amount, uint256) external returns (uint256) {
        emit LogExit(token, amount);
        return amount;
    }

    function getMorphoToken() external pure returns (address) {
        return MORPHO_TOKEN;
    }
}
