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

contract ConvexConnectorMock {
    mapping (address => address) public getCvxPool;

    mapping (address => address) public getCurvePool;

    event LogClaim(address cvxPool);

    event LogJoin(address curvePool, uint256 amount);

    event LogExit(address cvxPool, uint256 amount);

    function setCvxPool(address curvePool, address cvxPool) external {
        getCvxPool[curvePool] = cvxPool;
    }

    function setCurvePool(address cvxPool, address curvePool) external {
        getCurvePool[cvxPool] = curvePool;
    }

    function claim(address cvxPool) external returns (address[] memory tokens, uint256[] memory amounts) {
        emit LogClaim(cvxPool);
        tokens = new address[](0);
        amounts = new uint256[](0);
    }

    function join(address curvePool, uint256 amount) external returns (uint256) {
        emit LogJoin(curvePool, amount);
        return amount;
    }

    function exit(address cvxPool, uint256 amount) external returns (uint256) {
        emit LogExit(cvxPool, amount);
        return amount;
    }
}
