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

import '@openzeppelin/contracts/interfaces/IERC4626.sol';

import '@mimic-fi/v3-helpers/contracts/utils/ERC20Helpers.sol';

import '../../interfaces/liquidity/erc4626/IERC4626Connector.sol';

/**
 * @title ERC4626Connector
 */
contract ERC4626Connector is IERC4626Connector {
    // Reference to the underlying ERC4626
    address public immutable override erc4626;

    /**
     * @dev Creates a new ERC4626 connector
     */
    constructor(address _erc4626) {
        erc4626 = _erc4626;
    }

    /**
     * @dev Deposits assets to the underlying ERC4626
     * @param assets Amount of assets to be deposited
     */
    function join(uint256 assets) external override returns (address token, uint256 deposited) {
        token = getToken();
        if (assets == 0) return (token, 0);
        ERC20Helpers.approve(token, erc4626, assets);
        uint256 shares = IERC4626(erc4626).deposit(assets, address(this));
        deposited = IERC4626(erc4626).convertToAssets(shares);
        if (deposited < assets) revert ERC4626InvalidDeposit(deposited, assets);
    }

    /**
     * @dev Withdtaws assets from the underlying ERC4626
     * @param shares Amount of shares to be redeemed
     */
    function exit(uint256 shares) external override returns (address token, uint256 redeemed) {
        token = getToken();
        if (shares == 0) return (token, 0);
        uint256 assets = IERC4626(erc4626).redeem(shares, address(this), address(this));
        redeemed = IERC4626(erc4626).convertToShares(assets);
        if (redeemed < shares) revert ERC4626InvalidRedeem(redeemed, shares);
    }

    /**
     * @dev Tells the underlying token of the ERC4626
     */
    function getToken() internal view returns (address) {
        return IERC4626(erc4626).asset();
    }
}
