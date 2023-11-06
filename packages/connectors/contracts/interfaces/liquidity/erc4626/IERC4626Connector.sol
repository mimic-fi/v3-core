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

/**
 * @title ERC4626 connector interface
 */
interface IERC4626Connector {
    /**
     * @dev The amount deposited is lower than the expected amount
     */
    error ERC4626InvalidDeposit(uint256 actual, uint256 expected);

    /**
     * @dev The amount redeemed is lower than the expected amount
     */
    error ERC4626InvalidRedeem(uint256 actual, uint256 expected);

    /**
     * @dev Tells the reference to the underlying ERC4626
     */
    function erc4626() external view returns (address);

    /**
     * @dev Deposits assets to the underlying ERC4626
     * @param assets Amount of assets to be deposited
     */
    function join(uint256 assets) external returns (address token, uint256 deposited);

    /**
     * @dev Withdtaws assets from the underlying ERC4626
     * @param shares Amount of shares to be redeemed
     */
    function exit(uint256 shares) external returns (address token, uint256 redeemed);
}
