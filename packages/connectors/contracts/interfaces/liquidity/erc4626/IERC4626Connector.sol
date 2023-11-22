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
    error ERC4626BadSharesOut(uint256 shares, uint256 minSharesOut);

    /**
     * @dev The amount redeemed is lower than the expected amount
     */
    error ERC4626BadAssetsOut(uint256 assets, uint256 minAssetsOut);

    /**
     * @dev The post token in balance is lower than the previous token in balance minus the amount in
     */
    error ERC4626BadPostTokenInBalance(uint256 postBalanceIn, uint256 preBalanceIn, uint256 amountIn);

    /**
     * @dev Tells the underlying token of an ERC4626
     */
    function getToken(address erc4626) external view returns (address);

    /**
     * @dev Deposits assets to the underlying ERC4626
     * @param erc4626 Address of the ERC4626 to join
     * @param tokenIn Address of the token to join the ERC4626
     * @param assets Amount of assets to be deposited
     * @param minSharesOut Minimum amount of shares willing to receive
     */
    function join(address erc4626, address tokenIn, uint256 assets, uint256 minSharesOut)
        external
        returns (address tokenOut, uint256 shares);

    /**
     * @dev Withdraws assets from the underlying ERC4626
     * @param erc4626 Address of the ERC4626 to exit
     * @param shares Amount of shares to be redeemed
     * @param minAssetsOut Minimum amount of assets willing to receive
     */
    function exit(address erc4626, uint256 shares, uint256 minAssetsOut)
        external
        returns (address token, uint256 assets);
}
