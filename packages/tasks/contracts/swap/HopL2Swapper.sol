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

import '@mimic-fi/v3-helpers/contracts/utils/BytesHelpers.sol';
import '@mimic-fi/v3-connectors/contracts/swap/hop/IHopL2Amm.sol';
import '@mimic-fi/v3-connectors/contracts/swap/hop/HopSwapConnector.sol';

import './BaseSwapTask.sol';
import '../interfaces/swap/IHopL2Swapper.sol';

contract HopL2Swapper is IHopL2Swapper, BaseSwapTask {
    using FixedPoint for uint256;
    using BytesHelpers for bytes;

    // Execution type for relayers
    bytes32 public constant override EXECUTION_TYPE = keccak256('HOP_L2_SWAPPER');

    // List of AMMs per token
    mapping (address => address) public override tokenAmm;

    /**
     * @dev Token amm config. Only used in the initializer.
     */
    struct TokenAmm {
        address token;
        address amm;
    }

    /**
     * @dev Hop L2 swapper task config. Only used in the initializer.
     */
    struct HopL2SwapperConfig {
        TokenAmm[] tokenAmms;
        BaseSwapConfig baseSwapConfig;
    }

    /**
     * @dev Initializes a Hop L2 swapper task
     */
    function initialize(HopL2SwapperConfig memory config) external initializer {
        _initialize(config.baseSwapConfig);

        for (uint256 i = 0; i < config.tokenAmms.length; i++) {
            _setTokenAmm(config.tokenAmms[i].token, config.tokenAmms[i].amm);
        }
    }

    /**
     * @dev Sets an AMM for a hToken
     * @param hToken Address of the hToken to be set
     * @param amm AMM address to be set for the hToken
     */
    function setTokenAmm(address hToken, address amm) external authP(authParams(hToken, amm)) {
        _setTokenAmm(hToken, amm);
    }

    /**
     * @dev Execution function
     */
    function call(address hToken, uint256 amount, uint256 slippage)
        external
        override
        authP(authParams(hToken, amount, slippage))
        baseSwapTaskCall(hToken, amount, slippage)
    {
        address tokenOut = _getApplicableTokenOut(hToken);
        address dexAddress = IHopL2Amm(tokenAmm[hToken]).exchangeAddress();
        uint256 minAmountOut = amount.mulUp(FixedPoint.ONE - slippage);

        bytes memory connectorData = abi.encodeWithSelector(
            HopSwapConnector.execute.selector,
            hToken,
            tokenOut,
            amount,
            minAmountOut,
            dexAddress
        );

        bytes memory result = ISmartVault(smartVault).execute(connector, connectorData);
        _increaseBalanceConnector(tokenOut, result.toUint256());
    }

    /**
     * @dev Hook to be called before the swap task call starts. This implementation calls the base swap task hooks
     * and validates there is an AMM defined for the given hToken to be swapped.
     */
    function _beforeSwapTask(address token, uint256 amount, uint256 slippage) internal virtual override {
        super._beforeSwapTask(token, amount, slippage);
        require(tokenAmm[token] != address(0), 'TASK_MISSING_HOP_TOKEN_AMM');
    }

    /**
     * @dev Set an AMM for a Hop token
     * @param hToken Address of the hToken to set an AMM for
     * @param amm AMM to be set
     */
    function _setTokenAmm(address hToken, address amm) internal {
        require(hToken != address(0), 'TASK_HOP_TOKEN_ZERO');
        require(amm == address(0) || hToken == IHopL2Amm(amm).hToken(), 'TASK_HOP_TOKEN_AMM_MISMATCH');

        tokenAmm[hToken] = amm;
        emit TokenAmmSet(hToken, amm);
    }
}
