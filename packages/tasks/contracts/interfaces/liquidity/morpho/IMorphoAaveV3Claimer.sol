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
     * @dev The token is not the Morpho token
     */
    error TaskTokenNotMorpho();

    /**
     * @dev The proof array is empty
     */
    error TaskProofEmpty();

    /**
     * @dev The length of the claim result mismatch
     */
    error TaskClaimResultLengthMismatch();

    /**
     * @dev Executes the Morpho-Aave V3 claimer task
     */
    function call(address token, uint256 amount, bytes32[] calldata proof) external;
}
