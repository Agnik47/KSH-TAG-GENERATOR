import csv,re
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.graphics.barcode import code128
D='/usr/share/fonts/truetype/dejavu/'
pdfmetrics.registerFont(TTFont('R',D+'DejaVuSans.ttf'));pdfmetrics.registerFont(TTFont('B',D+'DejaVuSans-Bold.ttf'))
# DESIGN is landscape 125 x 75 mm. ROLL is 75 wide x 125 long -> print PDF is the design rotated 90 deg.
DW,DH=125*mm,75*mm
MRP={'bt624y':1749,'fe3037blue':1688,'bt596grn':1748,'fep3511mlt':2013,'fe3302sg':2350,'bt544gry':1399,'bt539cfe':998,'fe3321blk':1018,'fe3149pch':1570,'fe3149y':1245}
P={};T={};COL={};cur=None;col=None
for r in csv.reader(open('/mnt/user-data/outputs/KSH_test_100_products_import.csv')):
    if r[0]=='Handle':continue
    if r[1]: cur=r[1]
    if r[3]: col=r[3]
    P[r[11]]=float(r[13]);T[r[11]]=cur;COL[r[11]]=col
S={r[8]:int(r[18] or 0) for r in csv.reader(open('/mnt/user-data/outputs/KSH_test_100_stock_import_v2.csv')) if r[8]!='SKU'}
def clean(t,c): return t.replace(c,'').replace('()','').replace('(','').replace(')','').strip(' -')
def span(sku):  # '0-3_Months' -> (0,3) in months ; '1-2_Years' -> (12,24)
    m=re.search(r'_(\d+)-(\d+)_(Months|Years)$',sku); a,b,u=int(m[1]),int(m[2]),m[3]
    k=12 if u=='Years' else 1; return a*k,b*k
def fmt(m): return f'{m//12}Y' if (m%12==0 and m>0) else f'{m}M'
def size_range(skus):
    lo=min(span(s)[0] for s in skus); hi=max(span(s)[1] for s in skus); return f'{fmt(lo)} – {fmt(hi)}'
def tag(cv,code):
    allss=[s for s in P if s.split('_')[0]==code]
    ss=[s for s in allss if S.get(s,0)>0]
    price=max(P[s] for s in allss); mrp=MRP[code]
    sku0=allss[0]; name=clean(T[sku0],code); colr=COL[sku0].replace('-1','').title(); sz=size_range(ss)
    p=6*mm
    cv.setFont('B',8); cv.drawString(p,DH-6*mm,'KIDS SURPLUS HUB')
    fs=9
    while pdfmetrics.stringWidth('Product : '+name,'R',fs)>DW-2*p and fs>6: fs-=.5
    cv.setFont('R',fs); cv.drawString(p,DH-11.5*mm,'Product : '+name)
    cv.setFont('R',9); cv.drawString(p,DH-17*mm,f'SKU : {code}  |  Color : {colr}  |  Size : ')
    x=p+pdfmetrics.stringWidth(f'SKU : {code}  |  Color : {colr}  |  Size : ','R',9)
    cv.setFont('B',11); cv.drawString(x,DH-17*mm,sz)
    # MRP (left) and OUR PRICE (right)
    y=DH-25*mm
    cv.setFont('B',8.5); cv.drawString(p,y,'MAXIMUM RETAIL PRICE')
    cv.setFont('R',16); t=f'₹{mrp:.2f}'; cv.setFillGray(0.35); cv.drawString(p,y-8*mm,t)
    w=pdfmetrics.stringWidth(t,'R',16); cv.setLineWidth(1.2); cv.line(p-1,y-8*mm+2.4*mm,p+w+1,y-8*mm+2.4*mm); cv.setFillGray(0)
    cv.setFont('R',6.5); cv.drawString(p,y-12.5*mm,'(Inclusive of all Taxes)')
    rx=DW/2+4*mm
    cv.setFont('B',8.5); cv.drawString(rx,y,'OUR PRICE')
    cv.setFont('B',26); cv.drawString(rx,y-9.5*mm,f'₹{price:.0f}')
    cv.setFont('R',7.5); cv.drawString(rx,y-13*mm,f'You save ₹{mrp-price:.0f}')
    # barcode full width
    bw=0.625*mm
    bc=code128.Code128(code,barHeight=12*mm,barWidth=bw,humanReadable=False,quiet=False)
    if bc.width>DW-2*p: bc=code128.Code128(code,barHeight=12*mm,barWidth=0.5*mm,humanReadable=False,quiet=False)
    bc.drawOn(cv,(DW-bc.width)/2,22*mm)
    cv.setFont('B',9); cv.drawCentredString(DW/2,17.5*mm,code)
    cv.setLineWidth(0.4); cv.line(p,15*mm,DW-p,15*mm)
    cv.setFont('R',5.6)
    cv.drawCentredString(DW/2,11.5*mm,'Marketed by: Kotemoda Lifestyle Pvt. Ltd.  |  Country of Origin: India  |  Net Qty: 1 N')
    cv.drawCentredString(DW/2,8*mm,'Customer care: 9972769817  |  care@wishkaro.com')
    return sz,price,mrp
# 1) landscape PREVIEW (for viewing on screen)
cv=canvas.Canvas('/mnt/user-data/outputs/KSH_tag_test_10_landscape_preview.pdf',pagesize=(DW,DH))
rows=[]
for c in MRP: rows.append((c,)+tag(cv,c)); cv.showPage()
cv.save()
# 2) PRINT file: page = roll (75 wide x 125 long), design rotated 90 deg
cv=canvas.Canvas('/mnt/user-data/outputs/KSH_tag_test_10_print_75x125.pdf',pagesize=(DH,DW))
for c in MRP:
    cv.saveState(); cv.translate(DH,0); cv.rotate(90); tag(cv,c); cv.restoreState(); cv.showPage()
cv.save()
for r in rows: print(r)
