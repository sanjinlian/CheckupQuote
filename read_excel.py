import pandas as pd
df = pd.read_excel('20250706廠商報價即已知報價彙整-設計師利潤另加.xlsx', sheet_name=0, header=None)
print(df.head(25).to_string())
