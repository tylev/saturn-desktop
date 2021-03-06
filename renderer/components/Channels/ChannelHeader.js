import React from 'react'
import PropTypes from 'prop-types'
import { injectIntl } from 'react-intl'
import styled from 'styled-components'
import { opacity, height } from 'styled-system'
import { Box as BaseBox, Flex as BaseFlex } from 'rebass/styled-components'
import { intlShape } from '@zap/i18n'
import { Bar, Heading, Text } from 'components/UI'
import { withEllipsis } from 'hocs'
import ChannelStatus from './ChannelStatus'

const ClippedHeading = withEllipsis(Heading.h1)
const ClippedText = withEllipsis(Text)
const Box = styled(BaseBox)(opacity)
const Flex = styled(BaseFlex)(opacity, height)

const ChannelHeader = ({ intl, channel, ...rest }) => {
  const { displayName, displayPubkey, displayStatus } = channel
  return (
    <Box {...rest}>
      <Flex justifyContent="space-between">
        <ClippedHeading my={1}>{displayName}</ClippedHeading>
        <ChannelStatus mb="auto" status={displayStatus} />
      </Flex>
      <ClippedText>{displayPubkey}</ClippedText>
      <Box>
        <Bar my={3} />
      </Box>
    </Box>
  )
}

ChannelHeader.propTypes = {
  channel: PropTypes.object.isRequired,
  intl: intlShape.isRequired,
}

export default injectIntl(ChannelHeader)
