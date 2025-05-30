import * as React from 'react';
import { Content, ContentVariants } from '@patternfly/react-core';

type BaseSectionProps = React.PropsWithChildren<{
  title: React.ReactNode;
}>;

export const BaseSection: React.FC<BaseSectionProps> = ({ children, title }) => (
  <>
    <Content
      component={ContentVariants.p}
      className="pf-v6-u-font-weight-bold"
      style={{
        marginTop: 'var(--pf-t--global--spacer--md)',
      }}
    >
      {title}
    </Content>
    {children}
  </>
);
