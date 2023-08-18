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

import './IBaseMorphoAaveV3Task.sol';

/**
 * @dev Morpho-Aave V3 claimer task interface
 */
interface IMorphoAaveV3Claimer is IBaseMorphoAaveV3Task {
    /**
     * @dev The Morpho token is zero
     */
    error TaskMorphoTokenZero();

    /**
     * @dev The proof array is empty
     */
    error TaskProofEmpty();

    /**
     * @dev Emitted every time the Morpho token is set
     */
    event MorphoTokenSet(address indexed morphoToken);

    /**
     * @dev Tells the Morpho token tied to the task
     */
    function morphoToken() external view returns (address);

    /**
     * @dev Sets a new Morpho token
     * @param newMorphoToken Address of the Morpho token to be set
     */
    function setMorphoToken(address newMorphoToken) external;

    /**
     * @dev Executes the Morpho-Aave V3 claimer task
     */
    function call(uint256 amount, bytes32[] calldata proof) external;
}
