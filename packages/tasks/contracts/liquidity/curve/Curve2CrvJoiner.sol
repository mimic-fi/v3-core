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
import '@mimic-fi/v3-connectors/contracts/interfaces/curve/ICurve2CrvConnector.sol';

import './BaseCurveTask.sol';
import '../../interfaces/liquidity/curve/ICurve2CrvJoiner.sol';

/**
 * @title Curve 2CRV joiner
 * @dev Task that extends the base Curve task to join 2CRV pools
 */
contract Curve2CrvJoiner is ICurve2CrvJoiner, BaseCurveTask {
    using BytesHelpers for bytes;

    // Execution type for relayers
    bytes32 public constant override EXECUTION_TYPE = keccak256('CURVE_2CRV_JOINER');

    /**
     * @dev Curve 2CRV join config. Only used in the initializer.
     */
    struct Curve2CrvJoinConfig {
        BaseCurveConfig baseCurveConfig;
    }

    /**
     * @dev Initializes a Curve 2CRV joiner
     * @param config Curve 2CRV join config
     */
    function initialize(Curve2CrvJoinConfig memory config) external virtual initializer {
        __Curve2CrvJoiner_init(config);
    }

    /**
     * @dev Initializes the Curve 2CRV joiner. It does call upper contracts initializers.
     * @param config Curve 2CRV join config
     */
    function __Curve2CrvJoiner_init(Curve2CrvJoinConfig memory config) internal onlyInitializing {
        __BaseCurveTask_init(config.baseCurveConfig);
        __Curve2CrvJoiner_init_unchained(config);
    }

    /**
     * @dev Initializes the Curve 2CRV joiner. It does not call upper contracts initializers.
     * @param config Curve 2CRV join config
     */
    function __Curve2CrvJoiner_init_unchained(Curve2CrvJoinConfig memory config) internal onlyInitializing {
        // solhint-disable-previous-line no-empty-blocks
    }

    /**
     * @dev Execute Curve 2CRV joiner
     * @param token Address of the token to join the Curve pool with
     * @param amount Amount of tokens to join the Curve pool with
     */
    function call(address token, uint256 amount, uint256 slippage)
        external
        override
        authP(authParams(token, amount, slippage))
    {
        if (amount == 0) amount = getTaskAmount(token);
        _beforeCurve2CrvJoiner(token, amount, slippage);

        address tokenOut = getTokenOut(token);
        bytes memory connectorData = abi.encodeWithSelector(
            ICurve2CrvConnector.join.selector,
            tokenOut,
            token,
            amount,
            slippage
        );

        bytes memory result = ISmartVault(smartVault).execute(connector, connectorData);
        _afterCurve2CrvJoiner(token, amount, slippage, tokenOut, result.toUint256());
    }

    /**
     * @dev Before Curve 2CRV joiner hook
     */
    function _beforeCurve2CrvJoiner(address token, uint256 amount, uint256 slippage) internal virtual {
        _beforeBaseCurveTask(token, amount, slippage);
    }

    /**
     * @dev After Curve 2CRV joiner hook
     */
    function _afterCurve2CrvJoiner(
        address tokenIn,
        uint256 amountIn,
        uint256 slippage,
        address tokenOut,
        uint256 amountOut
    ) internal virtual {
        _afterBaseCurveTask(tokenIn, amountIn, slippage, tokenOut, amountOut);
    }
}
