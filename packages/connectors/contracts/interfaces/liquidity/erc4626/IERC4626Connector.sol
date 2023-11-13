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
     * @dev The token is not the underlying token of the ERC4626
     */
    error ERC4626InvalidToken(address token, address underlying);

    /**
     * @dev The amount deposited is lower than the expected amount
     */
    error ERC4626InvalidDeposit(uint256 actual, uint256 expected);

    /**
     * @dev The amount redeemed is lower than the expected amount
     */
    error ERC4626InvalidRedeem(uint256 actual, uint256 expected);

    /**
     * @dev Deposits assets to the underlying ERC4626
     * @param erc4626 Address of the ERC4626 to join
     * @param tokenIn Address of the token to join the ERC4626
     * @param assets Amount of assets to be deposited
     */
    function join(address erc4626, address tokenIn, uint256 assets)
        external
        returns (address tokenOut, uint256 depositedShares);

    /**
     * @dev Withdtaws assets from the underlying ERC4626
     * @param erc4626 Address of the ERC4626 to exit
     * @param shares Amount of shares to be redeemed
     */
    function exit(address erc4626, uint256 shares) external returns (address token, uint256 redeemedAssets);
}
