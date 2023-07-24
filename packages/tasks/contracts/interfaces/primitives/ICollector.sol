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

import '../ITask.sol';

/**
 * @dev Collector task interface
 */
interface ICollector is ITask {
    /**
     * @dev The tokens source is zero
     */
    error TaskTokensSourceZero();

    /**
     * @dev Emitted every time the tokens source is set
     */
    event TokensSourceSet(address indexed tokensSource);

    /**
     * @dev Sets the tokens source address
     * @param tokensSource Address of the tokens source to be set
     */
    function setTokensSource(address tokensSource) external;

    /**
     * @dev Executes the withdrawer task
     */
    function call(address token, uint256 amount) external;
}
