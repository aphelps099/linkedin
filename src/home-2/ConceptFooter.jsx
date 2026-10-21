import React, {memo} from 'react';
import {SiteFooter} from '../brand/SiteFooter.jsx';

export const ConceptFooter = memo(function ConceptFooter({base='/'}) {
  return <SiteFooter base={base}/>;
});
